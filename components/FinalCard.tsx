"use client";
import { useLit } from "./useLit";
import { CountUp } from "./CountUp";

/** The figure the deck lands on: gradient card with a running border light and a breathing glow. */
export function FinalCard({
  label,
  value,
  unit,
  className = "",
  size = "lg",
}: {
  label: string;
  value: string;
  unit?: string;
  className?: string;
  size?: "lg" | "md";
}) {
  const [ref, lit] = useLit<HTMLDivElement>(0.3);
  return (
    <div ref={ref} data-lit={lit} className={`glow-card is-final flex flex-col justify-between p-7 md:p-10 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="label !text-text">{label}</p>
        {unit && <p className="text-base text-muted">{unit}</p>}
      </div>
      <p
        className={`final-pulse num mt-[clamp(1.5rem,5vh,3.5rem)] font-light leading-none tracking-[-0.035em] text-text ${
          size === "lg" ? "text-[clamp(3.25rem,min(7.4vw,14vh),8.5rem)]" : "text-[clamp(2.6rem,min(4.3vw,10vh),5.5rem)]"
        }`}
      >
        <CountUp raw={value} duration={2} />
      </p>
    </div>
  );
}
