/**
 * Replace the synthetic test fixture with the real deck.
 *   npm run deck:dump        (needs DECK_ID + credentials in .env.local)
 * Writes fixtures/deck.slides.json and fixtures/images/*, rewriting image URLs to fixture:<file>.
 * Afterwards, re-run `npm test` and adjust expectations if the deck content changed.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fetchPresentation } from "../lib/deck";

async function main() {
  delete process.env.DECK_SOURCE;
  const p = await fetchPresentation();
  const dir = path.join(process.cwd(), "fixtures", "images");
  await fs.mkdir(dir, { recursive: true });
  const walk = async (node: unknown): Promise<void> => {
    if (Array.isArray(node)) return void (await Promise.all(node.map(walk)));
    if (!node || typeof node !== "object") return;
    const el = node as { objectId?: string; image?: { contentUrl?: string } };
    if (el.image?.contentUrl && el.objectId) {
      const res = await fetch(el.image.contentUrl);
      const file = `${el.objectId}.img`;
      await fs.writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
      el.image.contentUrl = `fixture:${file}`;
    }
    await Promise.all(Object.values(node).map(walk));
  };
  await walk(p);
  await fs.writeFile(path.join(process.cwd(), "fixtures", "deck.slides.json"), JSON.stringify(p, null, 1));
  console.log(`wrote ${p.slides?.length ?? 0} slides`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
