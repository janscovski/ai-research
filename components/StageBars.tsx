"use client";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { parseRupiah } from "@/lib/numbers";
import { CountUp } from "./CountUp";
import { FinalCard } from "./FinalCard";
import { Strike } from "./Strike";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Initial → Previous → Final. Earlier figures count up, then get a red strike;
 * the last figure stands alone in a glowing card so the eye ends there.
 * Bars are scaled to the parsed values so the drop is visible.
 */
export function StageBars({ stages }: { stages: { label: string; value: string; unit?: string }[] }) {
  const reduce = useReducedMotion();
  // Observe the list, not the bars: a bar at scaleX(0) has no area, so it would never "enter" the view.
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const shown = reduce || inView;
  const values = stages.map((s) => parseRupiah(s.value) ?? 0);
  const max = Math.max(...values, 1);
  const earlier = stages.slice(0, -1);
  const final = stages[stages.length - 1];
  return (
    <div ref={ref} className="grid items-stretch gap-[clamp(1.5rem,5vh,3rem)] lg:grid-cols-12 lg:gap-12">
      <ol className="grid content-center gap-[clamp(1.25rem,5vh,3rem)] lg:col-span-6">
        {earlier.map((s, i) => (
          <li key={s.label} className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="label">{s.label}</p>
              {s.unit && <p className="text-base text-faint">{s.unit}</p>}
            </div>
            <p className="num relative w-fit text-[clamp(2.2rem,min(5vw,9vh),4.75rem)] font-light leading-none tracking-[-0.03em] text-muted">
              <CountUp raw={s.value} duration={1.4 + i * 0.3} />
              <Strike show={shown} delay={1.5 + i * 0.4} />
            </p>
            <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-line">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-text/40"
                style={{ width: `${((values[i] / max) * 100).toFixed(2)}%`, transformOrigin: "left" }}
                initial={{ scaleX: reduce ? 1 : 0 }}
                animate={{ scaleX: shown ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : 1.6 + i * 0.3, ease }}
              />
            </div>
          </li>
        ))}
      </ol>
      {final && (
        <div className="lg:col-span-6">
          <motion.div
            className="h-full"
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={shown ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 1.1, ease, delay: reduce ? 0 : 1.0 }}
          >
            <FinalCard label={final.label} value={final.value} unit={final.unit} className="h-full md:min-h-[44vh]" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
