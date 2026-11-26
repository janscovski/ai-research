import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** getDeck(): live -> snapshot -> cache fallback -> error state, without touching Google. */
const fresh = async () => {
  vi.resetModules();
  return import("../lib/deck");
};

describe("getDeck cache fallback", () => {
  const env = { ...process.env };
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "deck-"));
    process.env.DECK_CACHE_DIR = dir;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_API_KEY;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("fetches, caches images locally and writes a snapshot", async () => {
    process.env.DECK_SOURCE = "fixture";
    const r = await (await fresh()).getDeck();
    expect(r.ok && r.source).toBe("fixture");
    expect(existsSync(path.join(dir, "deck.json"))).toBe(true);
    const files = readdirSync(path.join(dir, "images"));
    expect(files.length).toBe(16); // 8 images x 2 widths
    // no Google URL ever reaches the page data
    expect(JSON.stringify(r)).not.toContain("fixture:");
  });

  it("serves the last good snapshot when the deck is unreachable", async () => {
    process.env.DECK_SOURCE = "fixture";
    await (await fresh()).getDeck();
    delete process.env.DECK_SOURCE; // now "live" with no credentials -> fetch fails
    process.env.DECK_ID = "x";
    const r = await (await fresh()).getDeck(); // new module instance: memory empty, reads disk
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("cache");
      expect(r.stale).toBe(true);
      expect(r.deck.chapters.length).toBe(8);
    }
  });

  it("returns an error result (branded error state) when there is no snapshot", async () => {
    delete process.env.DECK_SOURCE;
    process.env.DECK_ID = "x";
    const r = await (await fresh()).getDeck();
    expect(r.ok).toBe(false);
  });

  it("image route helper rejects path traversal", async () => {
    const { ensureImage } = await fresh();
    expect(await ensureImage("../deck.json")).toBeNull();
  });
});
