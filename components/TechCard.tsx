"use client";
import type { ReactNode } from "react";
import { useLit } from "./useLit";

/** Card with a thin light trace along its border: one pass on scroll-into-view, then a slow idle shimmer. */
export function TechCard({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "figure";
}) {
  const [ref, lit] = useLit<HTMLDivElement>();
  return (
    <Tag
      ref={ref as never}
      data-lit={lit}
      className={`tech-card ${className}`}
      style={{ ["--trace-delay" as string]: `${delay}s` }}
    >
      <svg className="trace" aria-hidden="true" focusable="false">
        <rect x="0.5" y="0.5" rx="6" ry="6" pathLength={1} style={{ width: "calc(100% - 1px)", height: "calc(100% - 1px)" }} />
      </svg>
      {children}
    </Tag>
  );
}
