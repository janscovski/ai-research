"use client";
import { useEffect, useState } from "react";
import { formatLike, numericParts } from "@/lib/numbers";
import { prefersReducedMotion, useLit } from "./useLit";

/**
 * Counts up to a deck figure and always lands on the exact raw string.
 * Server HTML and screen readers get the raw value.
 */
export function CountUp({ raw, duration = 1.8, className = "" }: { raw: string; duration?: number; className?: string }) {
  const [ref, lit] = useLit<HTMLSpanElement>(0.6);
  const [text, setText] = useState(raw);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const parts = numericParts(raw);
    if (!parts || prefersReducedMotion()) return;
    setText(formatLike(parts, 0));
    setArmed(true);
  }, [raw]);

  useEffect(() => {
    const parts = numericParts(raw);
    if (!lit || !armed || !parts) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 4);
      setText(t < 1 ? formatLike(parts, parts.value * eased) : raw);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lit, armed, raw, duration]);

  return (
    <span ref={ref} className={`num ${className}`}>
      <span className="sr-only">{raw}</span>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
