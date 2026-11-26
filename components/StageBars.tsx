"use client";
import { motion, useReducedMotion } from "motion/react";
import { parseRupiah } from "@/lib/numbers";
import { CountUp } from "./CountUp";

const ease = [0.22, 1, 0.36, 1] as const;

/** Initial → Previous → Final: count-up figures over bars scaled to the parsed values. */
export function StageBars({ stages }: { stages: { label: string; value: string; unit?: string }[] }) {
  const reduce = useReducedMotion();
  const values = stages.map((s) => parseRupiah(s.value) ?? 0);
  const max = Math.max(...values, 1);
  return (
    <ol className="grid gap-10 md:gap-12">
      {stages.map((s, i) => {
        const final = i === stages.length - 1;
        const ratio = values[i] / max;
        return (
          <li key={s.label} className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="label">{s.label}</p>
              {s.unit && <p className="text-sm text-faint">{s.unit}</p>}
            </div>
            <p
              className={`relative w-fit text-[clamp(2.5rem,7vw,5.5rem)] font-light leading-none tracking-[-0.03em] ${
                final ? "text-accent" : "text-muted"
              }`}
            >
              <CountUp raw={s.value} duration={1.6 + i * 0.3} />
              {!final && (
                <motion.span
                  aria-hidden
                  className="absolute left-0 top-[55%] h-px w-full origin-left bg-text/50"
                  initial={{ scaleX: reduce ? 1 : 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease, delay: 2.2 + i * 0.3 }}
                />
              )}
            </p>
            <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-line">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${final ? "bg-accent shadow-[0_0_12px_var(--color-accent-glow)]" : "bg-text/35"}`}
                style={{ width: `${(ratio * 100).toFixed(2)}%`, transformOrigin: "left" }}
                initial={{ scaleX: reduce ? 1 : 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 1.8 + i * 0.3, ease }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
