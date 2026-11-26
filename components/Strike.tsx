"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

/** Thick red line drawn across a superseded figure once `show` is true, then a slow glow. */
export function Strike({ show, delay = 0 }: { show: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  const [drawn, setDrawn] = useState(false);
  return (
    <motion.span
      aria-hidden
      data-drawn={drawn}
      className="strike"
      initial={{ scaleX: reduce ? 1 : 0 }}
      animate={{ scaleX: show || reduce ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : 0.7, ease, delay: reduce ? 0 : delay }}
      onAnimationComplete={() => show && setDrawn(true)}
    />
  );
}
