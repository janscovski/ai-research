"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Slide-by-slide presentation shell.
 * Navigate with the small back/next controls, ← → / PageUp PageDown / Space,
 * a horizontal swipe, or the mouse wheel once a slide's own content has scrolled to its edge.
 * The slide number lives in the URL hash (#7) so a slide can be linked.
 */
export function SlideDeck({
  title,
  labels,
  preload,
  footer,
  children,
}: {
  title: string;
  labels: string[];
  preload: string[][];
  footer?: ReactNode;
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const lock = useRef(0);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === index) return;
      setDir(clamped > index ? 1 : -1);
      setIndex(clamped);
    },
    [index, total],
  );

  // Hash <-> slide
  useEffect(() => {
    const read = () => {
      const n = parseInt(window.location.hash.replace("#", ""), 10);
      if (n >= 1 && n <= total) setIndex(n - 1);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [total]);
  useEffect(() => {
    const want = `#${index + 1}`;
    if (window.location.hash !== want) history.replaceState(null, "", want);
    (window as Window & { __deckProgress?: number }).__deckProgress = total > 1 ? index / (total - 1) : 0;
    // warm up the next slides' images
    for (const src of [...(preload[index + 1] ?? []), ...(preload[index + 2] ?? [])]) {
      const img = new Image();
      img.src = src;
    }
  }, [index, total, preload]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(index + 1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, total]);

  // Wheel: only when the current slide cannot scroll further in that direction
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX) || Math.abs(e.deltaY) < 12) return;
      const scroller = el.querySelector<HTMLElement>("[data-active] [data-slide-scroll]");
      if (scroller) {
        const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        const atStart = scroller.scrollTop <= 2;
        if ((e.deltaY > 0 && !atEnd) || (e.deltaY < 0 && !atStart)) return;
      }
      e.preventDefault();
      const now = Date.now();
      if (now - lock.current < 900) return;
      lock.current = now;
      go(index + (e.deltaY > 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [go, index]);

  // Swipe
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1));
  };

  const offset = reduce ? 0 : 28;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* progress */}
      <div aria-hidden className="absolute inset-x-0 top-0 z-30 h-px bg-line">
        <div
          className="h-full origin-left bg-accent transition-transform duration-700 ease-[var(--ease-cinematic)]"
          style={{ transform: `scaleX(${(index + 1) / total})` }}
        />
      </div>
      {/* top-left: deck name */}
      <p
        aria-hidden
        style={{ opacity: index === 0 ? 0 : 1 }}
        className="pointer-events-none absolute left-5 top-5 z-30 transition-opacity duration-700 text-xs font-semibold uppercase tracking-[0.2em] text-text/80 md:left-[6vw] md:top-7">
        {title}
      </p>

      <main
        ref={stageRef}
        className="relative h-full w-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="carousel"
        aria-label={title}
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.section
            key={index}
            data-active
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${total}: ${labels[index] ?? ""}`}
            className="absolute inset-0"
            custom={dir}
            initial={{ opacity: 0, x: dir * offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -dir * offset }}
            transition={{ duration: reduce ? 0.2 : 0.9, ease }}
          >
            {slides[index]}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* navigator: small, bottom right */}
      <nav aria-label="Slides" className="absolute bottom-5 right-5 z-30 flex items-center gap-1 md:bottom-7 md:right-[6vw]">
        <NavButton label="Previous slide" disabled={index === 0} onClick={() => go(index - 1)}>
          <path d="M10 3 5 8l5 5" />
        </NavButton>
        <span className="num min-w-[4.5rem] text-center text-sm font-medium tracking-[0.08em] text-text/85" aria-live="polite">
          {String(index + 1).padStart(2, "0")} <span className="text-text/50">/ {String(total).padStart(2, "0")}</span>
        </span>
        <NavButton label="Next slide" disabled={index === total - 1} onClick={() => go(index + 1)}>
          <path d="m6 3 5 5-5 5" />
        </NavButton>
      </nav>
      {footer && index === total - 1 && <div className="absolute bottom-6 left-5 z-20 md:bottom-8 md:left-[6vw]">{footer}</div>}
    </div>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-base/60 text-text backdrop-blur-sm transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
