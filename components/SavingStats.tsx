"use client";
import { useInView } from "motion/react";
import { useRef } from "react";
import { CountUp } from "./CountUp";
import { FinalCard } from "./FinalCard";
import { Strike } from "./Strike";
import { TechCard } from "./TechCard";

/**
 * Reduction, saving and the final figure side by side. The saving is struck in
 * red (as asked): it is the money that no longer has to be spent, so the eye
 * lands on the final proposal card.
 */
export function SavingStats({
  reduction,
  saving,
  final,
}: {
  reduction?: { label: string; value: string };
  saving?: { label: string; value: string };
  final?: { label: string; value: string; unit?: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const n = [reduction, saving, final].filter(Boolean).length;
  const big = "text-[clamp(2.6rem,min(4.3vw,10vh),5.5rem)]";
  return (
    <div ref={ref} className={`grid gap-4 ${n === 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
      {reduction && (
        <TechCard className="flex flex-col justify-between p-7 md:min-h-[40vh] md:p-10">
          <p className="label">{reduction.label}</p>
          <p className={`num mt-10 font-extralight leading-none tracking-[-0.04em] text-accent ${big}`}>
            <CountUp raw={reduction.value} duration={2} />
          </p>
        </TechCard>
      )}
      {saving && (
        <TechCard delay={0.25} className="flex flex-col justify-between p-7 md:min-h-[40vh] md:p-10">
          <p className="label">{saving.label}</p>
          <p className={`num relative mt-10 w-fit font-extralight leading-none tracking-[-0.04em] text-muted ${big}`}>
            <CountUp raw={saving.value} duration={2} />
            <Strike show={inView} delay={2.2} />
          </p>
        </TechCard>
      )}
      {final && <FinalCard label={final.label} value={final.value} unit={final.unit} size="md" className="md:min-h-[40vh]" />}
    </div>
  );
}
