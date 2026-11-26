"use client";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import type { Plate as PlateT } from "@/lib/schema";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Cinematic chapter opener built from a divider slide: full-bleed image,
 * slow push-in while scrolling, edges dissolving into the animated background, title in light weight.
 * The image is the chapter's background; its drift is the only parallax.
 */
export function Plate({
  plate,
  kicker,
  headingId,
  children,
}: {
  plate: PlateT;
  kicker?: string;
  headingId: string;
  children?: React.ReactNode; // the <img>, rendered on the server
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.14, 1.03, 1]);
  const y = useTransform(scrollYProgress, [0, 1], ["-4%", "6%"]);
  const dim = useTransform(scrollYProgress, [0.5, 0.95], [0, 0.7]);

  return (
    <div ref={ref} className="relative h-[88svh] min-h-[520px] overflow-hidden md:h-[100svh]">
      {/* The image fades out through a mask (not a colour overlay), so the animated
          background shows through underneath: no seam between plate and page. */}
      <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_0%,black_14%,black_55%,transparent_100%)]">
        <motion.div className="absolute inset-0 will-change-transform" style={reduce ? undefined : { scale, y }}>
          {children}
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-base/55 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-base/60 via-base/10 to-transparent" />
        <motion.div className="absolute inset-0 bg-base" style={reduce ? { opacity: 0 } : { opacity: dim }} />
      </div>

      <div className="relative mx-auto flex h-full max-w-[1440px] flex-col justify-end px-5 pb-[14vh] md:px-12 md:pb-[16vh]">
        {kicker && (
          <motion.p
            className="kicker mb-5"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease }}
          >
            {kicker}
          </motion.p>
        )}
        <h2 id={headingId} className="max-w-[15ch] text-[clamp(2.6rem,8vw,7.25rem)] font-light leading-[0.98] tracking-[-0.035em] text-text">
          {plate.title.map((line, i) => (
            <motion.span
              key={i}
              className="block"
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -10% 0px" }}
              transition={{ duration: 1.6, ease, delay: 0.15 + i * 0.18 }}
            >
              {line}
            </motion.span>
          ))}
        </h2>
      </div>
    </div>
  );
}
