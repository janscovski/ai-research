import type { BlockOf } from "@/lib/schema";
import { DeckImg } from "./DeckImg";
import { Todo } from "./Todo";

/** Opening title card from the deck's cover slide. Pure CSS motion so it paints with the first HTML (LCP). */
export function Hero({ b }: { b: BlockOf<"hero"> }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {b.image?.src ? (
        <DeckImg image={b.image} alt={b.image.alt} priority className="hero-img absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-x-5 top-24">
          <Todo what="hero image: add a full-bleed image to the cover slide" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-base/35 via-base/5 to-base" />
      <div className="relative mx-auto flex h-full max-w-[1440px] flex-col items-center px-5 pt-[16svh] text-center md:px-12 md:pt-[14svh]">
        <h1
          id="hero-title"
          className="hero-title max-w-[16ch] text-[clamp(2.6rem,min(7.6vw,13vh),8rem)] font-semibold leading-[0.95] tracking-[-0.035em]"
        >
          {b.title}
        </h1>
        {b.subtitle.map((s, i) => (
          <p
            key={s}
            className="hero-in mt-5 max-w-[40ch] text-[clamp(1.05rem,min(1.6vw,2.8vh),1.6rem)] font-light tracking-[0.01em] text-text/90"
            style={{ animationDelay: `${0.35 + i * 0.15}s` }}
          >
            {s}
          </p>
        ))}
      </div>
    </div>
  );
}
