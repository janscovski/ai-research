import type { Chapter } from "@/lib/schema";
import { BlockView } from "./Blocks";
import { DeckImg } from "./DeckImg";
import { Plate } from "./Plate";
import { Reveal } from "./Reveal";

export function ChapterView({ chapter }: { chapter: Chapter }) {
  const headingId = `${chapter.id}-title`;
  return (
    <section id={chapter.id} aria-labelledby={headingId} className="relative">
      {chapter.plate ? (
        <Plate plate={chapter.plate} kicker={chapter.kicker} headingId={headingId}>
          {chapter.plate.image?.src && (
            <DeckImg image={chapter.plate.image} alt={chapter.plate.image.alt} className="h-full w-full object-cover" />
          )}
        </Plate>
      ) : (
        <header className="mx-auto max-w-[1440px] px-5 pt-[18vh] md:px-12">
          {chapter.kicker && <p className="kicker mb-6">{chapter.kicker}</p>}
          <Reveal>
            <h2 id={headingId} className="sr-only">
              {chapter.headline}
            </h2>
          </Reveal>
        </header>
      )}
      <div id={`${chapter.id}-body`} className="mx-auto grid max-w-[1440px] gap-32 px-5 pb-[18vh] pt-[10vh] md:gap-40 md:px-12">
        {chapter.blocks.map((b) => (
          <BlockView key={b.slideId} block={b} />
        ))}
      </div>
    </section>
  );
}
