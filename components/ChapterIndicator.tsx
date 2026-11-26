"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring } from "motion/react";

/** Fixed, quiet top bar: current chapter kicker + reading progress hairline. */
export function ChapterIndicator({ chapters }: { chapters: { id: string; kicker?: string }[] }) {
  const [current, setCurrent] = useState<string | undefined>();
  const currentRef = useRef(current);
  currentRef.current = current;
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    // Observe chapter bodies (not plates), so the label never doubles the plate's own kicker.
    const els = chapters.map((c) => document.getElementById(`${c.id}-body`) ?? document.getElementById(c.id)).filter(Boolean) as HTMLElement[];
    const hero = document.getElementById("hero");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace(/-body$/, "");
          if (e.isIntersecting) setCurrent(chapters.find((c) => c.id === id)?.kicker);
          else if (e.boundingClientRect.top > 0 && chapters.find((c) => c.id === id)?.kicker === currentRef.current) setCurrent(undefined);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    if (hero) io.observe(hero);
    return () => io.disconnect();
  }, [chapters]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <motion.div className="h-px origin-left bg-accent/70" style={{ scaleX: progress }} />
      <div
        className="bg-gradient-to-b from-base via-base/80 to-transparent pb-8 pt-4 transition-opacity duration-700"
        style={{ opacity: current ? 1 : 0 }}
      >
        <p className="kicker mx-auto min-h-[1em] max-w-[1440px] px-5 text-text/70 md:px-12" aria-hidden>
          {current}
        </p>
      </div>
    </div>
  );
}
