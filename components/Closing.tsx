"use client";
import { useLit } from "./useLit";

/** The deck's last line, given the final frame. One slow light sweep through the type. */
export function Closing({ line }: { line: string }) {
  const [ref, lit] = useLit<HTMLParagraphElement>(0.5);
  return (
    <p
      ref={ref}
      data-lit={lit}
      className="sweep max-w-[14ch] pb-[0.12em] text-center text-[clamp(2.75rem,min(9vw,15vh),9rem)] font-light leading-[0.98] tracking-[-0.04em] [text-wrap:balance]"
    >
      {line}
    </p>
  );
}
