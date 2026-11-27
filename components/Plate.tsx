"use client";
import { motion, useReducedMotion } from "motion/react";
import { Fragment } from "react";
import type { Plate as PlateT } from "@/lib/schema";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Cinematic chapter opener built from a divider slide: full-bleed image with a
 * slow push-in, edges dissolving into the animated background, title in light weight.
 */
export function Plate({ plate, kicker, children }: { plate: PlateT; kicker?: string; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  // Title goes where the picture is quiet (shadow, empty wall), never over the subject.
  const side = plate.image?.textSide ?? "left";
  const right = side === "right";
  const top = side === "top";
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_0%,black_62%,transparent_100%)]">
        <motion.div
          className="absolute inset-0 will-change-transform"
          initial={reduce ? false : { scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 9, ease }}
        >
          {children}
        </motion.div>
        {/* legibility: the title always sits on dark */}
        <div className={`absolute inset-0 ${top ? "bg-gradient-to-b from-base/75 via-base/10 to-base/40" : "bg-gradient-to-t from-base/85 via-base/25 to-base/30"}`} />
        <div className={`absolute inset-0 ${right ? "bg-gradient-to-l" : "bg-gradient-to-r"} ${top ? "from-base/30" : "from-base/65"} via-base/15 to-transparent`} />
      </div>
      <div
        className={`relative mx-auto flex h-full max-w-[1440px] flex-col px-5 md:px-[6vw] ${
          top ? "items-center justify-start pt-[11vh] text-center md:pt-[9vh]" : "justify-end pb-[18vh] md:pb-[16vh]"
        } ${right ? "items-end text-right" : ""}`}
      >
        {kicker && (
          <motion.p
            className="kicker mb-5"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease, delay: 0.2 }}
          >
            {kicker}
          </motion.p>
        )}
        <h2 className={`${top ? "max-w-[30ch] text-[clamp(2.25rem,min(5.2vw,8.5vh),5.5rem)]" : "max-w-[15ch] text-[clamp(2.75rem,min(8vw,13vh),8rem)]"} font-semibold leading-[0.98] tracking-[-0.035em] text-text [text-wrap:balance] [text-shadow:0_2px_30px_rgb(0_0_0/0.45)]`}>
          {plate.title.map((line, i) => (
            <Fragment key={i}>
              {top && i > 0 ? " " : null}
            <motion.span
              className={top ? "inline-block" : "block"}
              initial={reduce ? false : { opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.5, ease, delay: 0.3 + i * 0.18 }}
            >
              {line}
            </motion.span>
            </Fragment>
          ))}
        </h2>
      </div>
    </div>
  );
}
