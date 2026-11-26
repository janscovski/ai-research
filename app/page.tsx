import type { Metadata } from "next";
import { cache } from "react";
import { ErrorState } from "@/components/ErrorState";
import { SlideDeck } from "@/components/SlideDeck";
import { buildFrames } from "@/components/Slides";
import { getDeck } from "@/lib/deck";
import type { BlockOf } from "@/lib/schema";
import { SITE_NAME } from "@/lib/site";

// ISR: the page is rebuilt from the deck at most once every 60 s.
// /api/revalidate can refresh it immediately.
export const revalidate = 60;

const load = cache(getDeck);

const heroOf = (r: Awaited<ReturnType<typeof getDeck>>) =>
  r.ok ? (r.deck.chapters.find((c) => c.section === "hero")?.blocks[0] as BlockOf<"hero"> | undefined) : undefined;

export async function generateMetadata(): Promise<Metadata> {
  const hero = heroOf(await load());
  return {
    title: hero?.title ?? SITE_NAME,
    description: hero?.subtitle.join(" · "),
  };
}

export default async function Page() {
  const r = await load();
  if (!r.ok) return <ErrorState />;

  const frames = buildFrames(r.deck);
  const synced = new Date(r.fetchedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

  return (
    <SlideDeck
      title={heroOf(r)?.title ?? SITE_NAME}
      labels={frames.map((f) => f.label)}
      preload={frames.map((f) => f.preload)}
      themes={frames.map((f) => f.theme ?? { tone: "blue" })}
      footer={
        <p className="text-xs text-faint">
          {r.stale ? "Cached" : "Synced"} {synced} WIB
        </p>
      }
    >
      {frames.map((f) => (
        <div key={f.id} className="h-full w-full">
          {f.node}
        </div>
      ))}
    </SlideDeck>
  );
}
