import type { Metadata } from "next";
import { cache } from "react";
import { ChapterIndicator } from "@/components/ChapterIndicator";
import { ChapterView } from "@/components/ChapterView";
import { Closing } from "@/components/Closing";
import { ErrorState } from "@/components/ErrorState";
import { Hero } from "@/components/Hero";
import { getDeck } from "@/lib/deck";
import type { BlockOf } from "@/lib/schema";
import { SITE_NAME } from "@/lib/site";

// ISR: the page is rebuilt from the deck at most once every 60 s.
// /api/revalidate can refresh it immediately.
export const revalidate = 60;

const load = cache(getDeck);

export async function generateMetadata(): Promise<Metadata> {
  const r = await load();
  const hero = r.ok ? (r.deck.chapters.find((c) => c.section === "hero")?.blocks[0] as BlockOf<"hero"> | undefined) : undefined;
  return {
    title: hero?.title ?? SITE_NAME,
    description: hero?.subtitle.join(" · "),
  };
}

export default async function Page() {
  const r = await load();
  if (!r.ok) return <ErrorState />;

  const { chapters } = r.deck;
  const hero = chapters.find((c) => c.section === "hero");
  const rest = chapters.filter((c) => c.section !== "hero");
  const verdict = chapters.find((c) => c.section === "verdict")?.blocks.find((b) => b.kind === "verdict") as
    | BlockOf<"verdict">
    | undefined;
  const synced = new Date(r.fetchedAt);

  return (
    <>
      <ChapterIndicator chapters={chapters.map((c) => ({ id: c.id, kicker: c.kicker }))} />
      <main>
        {hero && <Hero b={hero.blocks[0] as BlockOf<"hero">} />}
        {rest.map((c) => (
          <ChapterView key={c.id} chapter={c} />
        ))}
        {verdict?.closing && <Closing line={verdict.closing} />}
      </main>
      <footer className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-2 border-t border-line px-5 py-8 text-xs text-faint md:px-12">
        <span>{r.deck.title}</span>
        <time dateTime={r.fetchedAt} suppressHydrationWarning>
          {r.stale ? "Cached " : "Synced "}
          {synced.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB
        </time>
      </footer>
    </>
  );
}
