import type { ReactNode } from "react";

/** BD reads blue, Marrakesh reads green, anything else falls back to the accent. */
export function teamTone(team: string): "bd" | "mk" | undefined {
  if (/\bbd\b|business\s*dev/i.test(team)) return "bd";
  if (/marrakesh/i.test(team)) return "mk";
  return undefined;
}

/** Card tinted with its team's colour: slow gradient drift and a light running along the border. */
export function TeamCard({ team, className = "", children }: { team: string; className?: string; children: ReactNode }) {
  const tone = teamTone(team);
  return <div className={`glow-card ${tone ? `is-${tone}` : ""} ${className}`}>{children}</div>;
}
