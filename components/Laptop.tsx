import type { DeckImage } from "@/lib/schema";
import { DeckImg } from "./DeckImg";

/** A screenshot shown on a dark laptop: bezel, camera notch, hinge and base, CSS only. */
export function Laptop({ image, alt }: { image: DeckImage; alt: string }) {
  return (
    <figure className="laptop mx-auto w-full max-w-[min(100%,calc(56vh*1.6))]">
      <div className="laptop-lid">
        <span aria-hidden className="laptop-cam" />
        <div className="laptop-screen">
          <DeckImg image={image} alt={alt} sizes="(min-width: 1024px) 60vw, 100vw" className="h-full w-full object-cover object-left-top" />
          <span aria-hidden className="laptop-glare" />
        </div>
      </div>
      <div aria-hidden className="laptop-base">
        <span className="laptop-notch" />
      </div>
    </figure>
  );
}
