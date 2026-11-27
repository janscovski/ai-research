/** Visible placeholder for content the design needs but the deck does not provide. Listed in README. */
export function Todo({ what }: { what: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-4 py-3 text-sm text-faint">
      <span className="font-semibold text-accent">TODO</span> · {what}
    </div>
  );
}
