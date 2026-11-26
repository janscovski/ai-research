import type { BlockOf } from "@/lib/schema";
import { DeckImg } from "./DeckImg";
import { Todo } from "./Todo";

/** Opening title card from the deck's cover slide. Pure CSS motion so it paints with the first HTML (LCP). */
export function Hero({ b }: { b: BlockOf<"hero"> }) {
  return (
    <section id="hero" aria-labelledby="hero-title" className="relative h-[100svh] min-h-[560px] overflow-hidden">
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
          className="hero-title max-w-[16ch] text-[clamp(2.4rem,7.4vw,6.6rem)] font-semibold leading-[0.95] tracking-[-0.035em]"
        >
          {b.title}
        </h1>
        {b.subtitle.map((s, i) => (
          <p
            key={s}
            className="hero-in mt-5 max-w-[40ch] text-[clamp(0.95rem,1.5vw,1.2rem)] font-light tracking-[0.01em] text-text/80"
            style={{ animationDelay: `${0.35 + i * 0.15}s` }}
          >
            {s}
          </p>
        ))}
      </div>
      <div aria-hidden className="absolute bottom-8 left-1/2 h-14 w-px -translate-x-1/2 overflow-hidden">
        <div className="cue h-full w-full bg-text/60" />
      </div>
    </section>
  );
}
