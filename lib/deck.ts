import "server-only";

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseDeck, type SlidesPresentation } from "./parser";
import { SnapshotSchema, type Deck, type DeckImage, type Snapshot } from "./schema";

/**
 * Server-only data layer for the live CMS.
 *
 * getDeck()
 *   1. Fetch the deck with Slides API `presentations.get` (service account or API key).
 *   2. If the content fingerprint matches the last good snapshot (and images are
 *      younger than 15 min), reuse it with no image work.
 *   3. Otherwise parse, download every image server-side (Google content URLs expire
 *      after ~30 min, so we never hotlink), convert to WebP, store under CACHE_DIR.
 *   4. Persist the snapshot (memory + CACHE_DIR/deck.json).
 *   5. On any failure: log it and serve the last good snapshot. No snapshot -> error state.
 *
 * Set DECK_SOURCE=fixture to run from fixtures/deck.slides.json without credentials.
 */

export type DeckResult =
  | { ok: true; deck: Deck; fetchedAt: string; source: "live" | "cache" | "fixture"; stale: boolean }
  | { ok: false; error: string };

const SLIDES_SCOPE = "https://www.googleapis.com/auth/presentations.readonly";
const IMAGE_WIDTHS = [960, 1920] as const;
export const IMAGE_FILE_RE = /^[a-f0-9]{16}-(960|1920)\.webp$/;

export const cacheDir = () =>
  process.env.DECK_CACHE_DIR ?? (process.env.VERCEL ? "/tmp/deck-cache" : path.join(process.cwd(), ".cache"));
const snapshotPath = () => path.join(cacheDir(), "deck.json");
export const imageDir = () => path.join(cacheDir(), "images");

let memory: Snapshot | null = null;
let inflight: Promise<DeckResult> | null = null;

const log = (...a: unknown[]) => console.error("[deck]", ...a);

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
async function authHeaders(): Promise<{ headers: Record<string, string>; query: string }> {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (sa) {
    const json = sa.trim().startsWith("{") ? sa : Buffer.from(sa, "base64").toString("utf8");
    const creds = JSON.parse(json) as { client_email: string; private_key: string };
    const { JWT } = await import("google-auth-library");
    const client = new JWT({ email: creds.client_email, key: creds.private_key, scopes: [SLIDES_SCOPE] });
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("service account returned no access token");
    return { headers: { Authorization: `Bearer ${token}` }, query: "" };
  }
  const key = process.env.GOOGLE_API_KEY;
  if (key) return { headers: {}, query: `?key=${encodeURIComponent(key)}` };
  throw new Error("no credentials: set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_API_KEY");
}

export async function fetchPresentation(): Promise<SlidesPresentation> {
  if (process.env.DECK_SOURCE === "fixture") {
    const raw = await fs.readFile(path.join(process.cwd(), "fixtures", "deck.slides.json"), "utf8");
    return JSON.parse(raw);
  }
  const id = process.env.DECK_ID;
  if (!id) throw new Error("DECK_ID is not set");
  const { headers, query } = await authHeaders();
  const res = await fetch(`https://slides.googleapis.com/v1/presentations/${encodeURIComponent(id)}${query}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Slides API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as SlidesPresentation;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
async function readImageBytes(url: string): Promise<Buffer> {
  if (url.startsWith("fixture:")) {
    const name = path.basename(url.slice("fixture:".length));
    return fs.readFile(path.join(process.cwd(), "fixtures", "images", name));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`image ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function cacheImage(img: DeckImage): Promise<DeckImage> {
  const bytes = await readImageBytes(img.url);
  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
  const meta = await sharp(bytes).metadata();
  await fs.mkdir(imageDir(), { recursive: true });
  let width = meta.width ?? 1600;
  let height = meta.height ?? 900;
  for (const w of IMAGE_WIDTHS) {
    const file = path.join(imageDir(), `${hash}-${w}.webp`);
    const exists = await fs.stat(file).then(() => true, () => false);
    if (!exists) {
      const out = await sharp(bytes).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
      await fs.writeFile(file, out.data);
      if (w === 1920) ({ width, height } = out.info);
    } else if (w === 1920) {
      const m = await sharp(file).metadata();
      width = m.width ?? width;
      height = m.height ?? height;
    }
  }
  // url is dropped from what we keep: it expires and must never reach the browser.
  return {
    key: img.key,
    url: "cached",
    alt: img.alt,
    ...(img.focus ? { focus: img.focus } : {}),
    width,
    height,
    src: `/api/deck-image/${hash}-1920.webp`,
    srcSmall: `/api/deck-image/${hash}-960.webp`,
  };
}

async function cacheAllImages(deck: Deck): Promise<Deck> {
  const tasks: Promise<void>[] = [];
  const visit = (holder: { image?: DeckImage }) => {
    if (!holder.image) return;
    const img = holder.image;
    tasks.push(
      cacheImage(img).then(
        (c) => void (holder.image = c),
        (e) => {
          log(`image ${img.key} failed, hiding it:`, e instanceof Error ? e.message : e);
          delete holder.image;
        },
      ),
    );
  };
  for (const c of deck.chapters) {
    if (c.plate) visit(c.plate);
    for (const b of c.blocks) visit(b);
  }
  await Promise.all(tasks);
  return deck;
}

// ---------------------------------------------------------------------------
// Snapshot store
// ---------------------------------------------------------------------------
async function readSnapshot(): Promise<Snapshot | null> {
  if (memory) return memory;
  try {
    const parsed = SnapshotSchema.safeParse(JSON.parse(await fs.readFile(snapshotPath(), "utf8")));
    if (parsed.success) return (memory = parsed.data);
    log("snapshot on disk is invalid, ignoring");
  } catch {
    /* no snapshot yet */
  }
  return null;
}

async function writeSnapshot(s: Snapshot) {
  memory = s;
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    const tmp = `${snapshotPath()}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(s));
    await fs.rename(tmp, snapshotPath());
  } catch (e) {
    log("could not persist snapshot (memory copy kept):", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Content fingerprint. `revisionId` is only returned to editors, and a Viewer
 * service account does not get it, so we hash the response minus the
 * per-request image URLs instead.
 */
export function fingerprint(p: SlidesPresentation): string {
  const json = JSON.stringify(p, (k, v) => (k === "contentUrl" ? undefined : v));
  return createHash("sha1").update(json).digest("hex");
}

/** Images are re-downloaded at least this often, to pick up "Replace image" edits that keep the same objectId. */
const IMAGE_REFRESH_MS = 15 * 60 * 1000;

async function load(force = false): Promise<DeckResult> {
  const source = process.env.DECK_SOURCE === "fixture" ? "fixture" : "live";
  try {
    const presentation = await fetchPresentation();
    const fp = fingerprint(presentation);
    const previous = await readSnapshot();
    const fresh = previous && Date.now() - Date.parse(previous.fetchedAt) < IMAGE_REFRESH_MS;
    if (!force && previous && fresh && previous.deck.revisionId === fp) {
      return { ok: true, deck: previous.deck, fetchedAt: previous.fetchedAt, source, stale: false };
    }
    const deck = { ...parseDeck(presentation), revisionId: fp };
    for (const w of deck.warnings) console.warn("[deck] parse:", w);
    await cacheAllImages(deck);
    const snap: Snapshot = { fetchedAt: new Date().toISOString(), deck };
    await writeSnapshot(snap);
    return { ok: true, deck, fetchedAt: snap.fetchedAt, source, stale: false };
  } catch (e) {
    log("live fetch failed:", e instanceof Error ? e.message : e);
    const snap = await readSnapshot();
    if (snap) return { ok: true, deck: snap.deck, fetchedAt: snap.fetchedAt, source: "cache", stale: true };
    return { ok: false, error: "Deck unreachable and no cached snapshot yet." };
  }
}

/** Fetch + parse + cache the deck. Concurrent callers share one in-flight request. */
export function getDeck(opts: { force?: boolean } = {}): Promise<DeckResult> {
  if (!inflight) inflight = load(opts.force).finally(() => (inflight = null));
  return inflight;
}

/** Used by the image route when an instance is missing a cached file (e.g. a fresh serverless instance). */
export async function ensureImage(file: string): Promise<Buffer | null> {
  if (!IMAGE_FILE_RE.test(file)) return null;
  const p = path.join(imageDir(), file);
  const read = () => fs.readFile(p).catch(() => null);
  const hit = await read();
  if (hit) return hit;
  await getDeck({ force: true }); // re-download images on this instance; snapshot is kept as fallback
  return read();
}
