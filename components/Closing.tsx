"use client";
import { useLit } from "./useLit";

/** The deck's last line, given the final frame. One slow light sweep through the type. */
export function Closing({ line }: { line: string }) {
  const [ref, lit] = useLit<HTMLParagraphElement>(0.6);
  return (
    <section aria-label={line} className="flex min-h-[80svh] items-center justify-center px-5 py-[16vh]">
      <p
        ref={ref}
        data-lit={lit}
        className="sweep max-w-[14ch] pb-[0.12em] text-center text-[clamp(2.6rem,9vw,8.5rem)] font-light leading-[0.98] tracking-[-0.04em]"
      >
        {line}
      </p>
    </section>
  );
}
