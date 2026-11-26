"use client";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { parseRupiah } from "@/lib/numbers";
import { CountUp } from "./CountUp";

const ease = [0.22, 1, 0.36, 1] as const;

/** Initial → Previous → Final: count-up figures over bars scaled to the parsed values. */
export function StageBars({ stages }: { stages: { label: string; value: string; unit?: string }[] }) {
  const reduce = useReducedMotion();
  // Observe the list, not the bars: a bar at scaleX(0) has no area, so it would never "enter" the view.
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const shown = reduce || inView;
  const values = stages.map((s) => parseRupiah(s.value) ?? 0);
  const max = Math.max(...values, 1);
  return (
    <ol ref={ref} className="grid gap-[clamp(1.25rem,4.5vh,3rem)]">
      {stages.map((s, i) => {
        const final = i === stages.length - 1;
        const ratio = values[i] / max;
        return (
          <li key={s.label} className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="label">{s.label}</p>
              {s.unit && <p className="text-base text-faint">{s.unit}</p>}
            </div>
            <p
              className={`relative w-fit text-[clamp(2.4rem,min(6.5vw,9.5vh),6rem)] font-light leading-none tracking-[-0.03em] ${
                final ? "text-accent" : "text-muted"
              }`}
            >
              <CountUp raw={s.value} duration={1.6 + i * 0.3} />
              {!final && (
                <motion.span
                  aria-hidden
                  className="absolute left-0 top-[55%] h-px w-full origin-left bg-text/50"
                  initial={{ scaleX: reduce ? 1 : 0 }}
                  animate={{ scaleX: shown ? 1 : 0 }}
                  transition={{ duration: 0.9, ease, delay: reduce ? 0 : 2.2 + i * 0.3 }}
                />
              )}
            </p>
            <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-line">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${final ? "bg-accent shadow-[0_0_12px_var(--color-accent-glow)]" : "bg-text/35"}`}
                style={{ width: `${(ratio * 100).toFixed(2)}%`, transformOrigin: "left" }}
                initial={{ scaleX: reduce ? 1 : 0 }}
                animate={{ scaleX: shown ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : 1.8 + i * 0.3, ease }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
