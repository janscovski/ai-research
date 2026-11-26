import type { Block, BlockOf, Card } from "@/lib/schema";
import { CountUp } from "./CountUp";
import { DeckImg } from "./DeckImg";
import { Reveal } from "./Reveal";
import { StageBars } from "./StageBars";
import { TechCard } from "./TechCard";

const pad = (n: number) => String(n + 1).padStart(2, "0");

/** Two-column editorial row: a quiet rail label on the left, content on the right. */
function Row({ rail, children, className = "" }: { rail?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-y-6 md:grid-cols-12 md:gap-x-10 ${className}`}>
      <div className="md:col-span-3">{rail && <p className="label md:sticky md:top-20">{rail}</p>}</div>
      <div className="md:col-span-9">{children}</div>
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-10 max-w-[22ch] text-[clamp(1.6rem,3.4vw,2.6rem)] font-normal leading-[1.08] tracking-[-0.02em]">{children}</h3>;
}

/** Numbered term grid, separated by hairlines rather than boxes. */
function IndexGrid({ items, cols = 3 }: { items: string[]; cols?: 2 | 3 }) {
  return (
    <ol className={`grid gap-x-8 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""}`}>
      {items.map((item, i) => (
        <li key={item + i} className="flex gap-5 border-t border-line py-6">
          <span className="num pt-1 text-xs font-semibold tracking-[0.14em] text-accent">{pad(i)}</span>
          <Reveal delay={i * 0.06} y={14}>
            <span className="text-[clamp(1.15rem,1.8vw,1.5rem)] font-light leading-snug">{item}</span>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

function NoteCards({ cards }: { cards: Card[] }) {
  if (!cards.length) return null;
  return (
    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c, i) => (
        <TechCard key={c.label + i} delay={i * 0.15} className="p-6">
          <p className="label">{c.label}</p>
          <p className="num mt-4 text-3xl font-light tracking-[-0.02em]">{c.value}</p>
          {c.note && <p className="mt-2 text-sm text-muted">{c.note}</p>}
        </TechCard>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Objective({ b }: { b: BlockOf<"objective"> }) {
  return (
    <div className="grid gap-20">
      {b.headline && <H3>{b.headline}</H3>}
      {b.pillars.length > 0 && <IndexGrid items={b.pillars} />}
      {b.roles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {b.roles.map((r, i) => (
            <TechCard key={r.team} delay={i * 0.25} className="p-7 md:p-10">
              <p className="label">{r.team}</p>
              <p className="mt-10 text-[clamp(1.75rem,3.6vw,2.9rem)] font-light leading-[1.05] tracking-[-0.025em]">{r.role}</p>
            </TechCard>
          ))}
        </div>
      )}
    </div>
  );
}

function Investment({ b }: { b: BlockOf<"investment"> }) {
  return (
    <div className="grid gap-24">
      {b.headline && <H3>{b.headline}</H3>}
      {b.stages.length > 0 && <StageBars stages={b.stages} />}

      {(b.reduction || b.saving) && (
        <div className="grid gap-4 md:grid-cols-2">
          {[b.reduction, b.saving].filter(Boolean).map((s, i) => (
            <TechCard key={s!.label} delay={i * 0.25} className="p-7 md:p-10">
              <p className="label">{s!.label}</p>
              <p className="mt-8 text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-none tracking-[-0.03em] text-accent">
                <CountUp raw={s!.value} />
              </p>
            </TechCard>
          ))}
        </div>
      )}

      {b.teams.length > 0 && (
        <div>
          {b.allocationLabel && <p className="label mb-6">{b.allocationLabel}</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            {b.teams.map((t, ti) => (
              <TechCard key={t.name} delay={ti * 0.25} className="overflow-hidden">
                <table className="w-full text-left text-[0.95rem]">
                  <caption className="sr-only">
                    {t.name} {t.total}
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="px-6 py-5 text-lg font-medium md:px-8">
                        {t.name}
                      </th>
                      <th scope="col" className="label px-6 py-5 text-right md:px-8">
                        <span className="sr-only">Amount</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.items.map((it) => (
                      <tr key={it.name} className="border-b border-line/70 last:border-0">
                        <th scope="row" className="px-6 py-4 font-normal md:px-8">
                          {it.name}
                          {it.note && <span className="mt-0.5 block text-sm text-faint">{it.note}</span>}
                        </th>
                        <td className="num whitespace-nowrap px-6 py-4 text-right text-muted md:px-8">{it.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                  {t.total && (
                    <tfoot>
                      <tr className="border-t border-line-strong bg-raised/60">
                        <th scope="row" className="label px-6 py-5 md:px-8">
                          Total
                        </th>
                        <td className="num whitespace-nowrap px-6 py-5 text-right text-lg font-medium md:px-8">{t.total}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </TechCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UseCases({ b }: { b: BlockOf<"usecases"> }) {
  return (
    <Row rail={b.team}>
      {b.headline && b.headline !== b.team && <H3>{b.headline}</H3>}
      {b.target && (
        <div className="mb-14">
          <p className="text-[clamp(5rem,16vw,12rem)] font-extralight leading-[0.85] tracking-[-0.05em]">
            <CountUp raw={b.target.count} duration={2.2} />
          </p>
          <p className="mt-5 max-w-[30ch] text-xl font-light text-muted">{b.target.label}</p>
        </div>
      )}
      {b.outputs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {b.outputs.map((o, i) => (
            <TechCard key={o.label} delay={i * 0.2} className="flex flex-col p-6 md:p-7">
              <p className="num text-5xl font-light tracking-[-0.03em]">
                <CountUp raw={o.count} />
              </p>
              <p className="mt-8 text-lg leading-snug">{o.label}</p>
              {o.meta.length > 0 && <p className="num mt-2 text-sm text-faint">{o.meta.join(" · ")}</p>}
            </TechCard>
          ))}
        </div>
      )}
      {b.supporting.length > 0 && (
        <div className="mt-20">
          {b.supportingTitle && <p className="label mb-4">{b.supportingTitle}</p>}
          <dl>
            {b.supporting.map((s) => (
              <div key={s.name} className="grid gap-1 border-t border-line py-5 md:grid-cols-3 md:gap-8">
                <dt className="font-medium">{s.name}</dt>
                <dd className="text-muted md:col-span-2">{s.desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {b.cases.length > 0 && <IndexGrid items={b.cases} cols={2} />}
    </Row>
  );
}

function Workflow({ b }: { b: BlockOf<"workflow"> }) {
  return (
    <div className="grid gap-6">
      {b.headline && <H3>{b.headline}</H3>}
      {b.pipelines.map((p, pi) => (
        <TechCard key={p.team + pi} delay={pi * 0.3} className="p-6 md:p-10">
          <p className="label mb-8">{p.team}</p>
          <ol className="pipeline-track relative grid gap-5 border-l border-line pl-6 md:flex md:gap-0 md:border-l-0 md:border-t md:pl-0 md:pt-8">
            {p.steps.map((s, i) => {
              const human = /human/i.test(s);
              return (
                <li key={s + i} className="relative md:flex-1 md:pr-4">
                  <span
                    aria-hidden
                    className={`absolute -left-[27.5px] top-1.5 h-2 w-2 rounded-full md:-top-[36.5px] md:left-0 ${
                      human ? "bg-accent shadow-[0_0_10px_var(--color-accent-glow)]" : "bg-line-strong"
                    }`}
                  />
                  <span className="num block text-xs font-semibold tracking-[0.14em] text-faint">{pad(i)}</span>
                  <span className={`mt-1 block text-[1.05rem] leading-snug ${human ? "text-accent" : ""}`}>{s}</span>
                </li>
              );
            })}
          </ol>
        </TechCard>
      ))}
    </div>
  );
}

const TIER_FILL: Record<string, number> = { LOW: 1, BALANCED: 2, POWERFUL: 3 };

function Efficiency({ b }: { b: BlockOf<"efficiency"> }) {
  return (
    <div>
      {b.headline && <H3>{b.headline}</H3>}
      {b.principles.length > 0 && <IndexGrid items={b.principles} />}
      {b.tiers.length > 0 && (
        <div className="mt-16">
          {b.tiersLabel && <p className="label mb-6">{b.tiersLabel}</p>}
          <div className="grid gap-4 md:grid-cols-3">
            {b.tiers.map((t, i) => {
              const fill = TIER_FILL[t.level.toUpperCase()] ?? i + 1;
              return (
                <TechCard key={t.level} delay={i * 0.2} className="p-6 md:p-7">
                  <div aria-hidden className="mb-10 flex gap-1.5">
                    {Array.from({ length: Math.max(3, b.tiers.length) }, (_, k) => (
                      <span key={k} className={`h-[3px] flex-1 rounded-full ${k < fill ? "bg-accent" : "bg-line"}`} />
                    ))}
                  </div>
                  <p className="text-sm font-semibold tracking-[0.18em]">{t.level}</p>
                  <p className="mt-2 text-lg font-light text-muted">{t.use}</p>
                </TechCard>
              );
            })}
          </div>
        </div>
      )}
      {b.body.length > 0 && (
        <div className="grid gap-3">
          {b.body.map((l) => (
            <p key={l} className="max-w-[60ch] text-lg font-light text-muted">
              {l}
            </p>
          ))}
        </div>
      )}
      {b.image?.src && (
        <TechCard as="figure" className="mt-12 overflow-hidden p-2 md:p-3">
          <DeckImg image={b.image} alt={b.image.alt || b.headline || ""} sizes="(min-width: 1024px) 900px, 100vw" className="h-auto w-full rounded-[4px]" />
        </TechCard>
      )}
    </div>
  );
}

function ActionPlan({ b }: { b: BlockOf<"action_plan"> }) {
  return (
    <div className="grid gap-20">
      {b.headline && <H3>{b.headline}</H3>}
      {b.lab && (
        <Reveal>
          <p className="max-w-[24ch] text-[clamp(1.9rem,4.2vw,3.4rem)] font-light leading-[1.05] tracking-[-0.025em]">{b.lab}</p>
        </Reveal>
      )}
      {b.prompts.length > 0 && (
        <Row rail={b.promptLabel}>
          <ol className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            {b.prompts.map((p, i) => (
              <li key={p} className="flex items-baseline gap-4 border-t border-line py-4">
                <span className="num text-xs font-semibold tracking-[0.14em] text-accent">{pad(i)}</span>
                <span className="text-lg font-light">{p}</span>
              </li>
            ))}
          </ol>
        </Row>
      )}
      {b.flow && (
        <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
          <ul className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
            {b.flow.inputs.map((x, i) => (
              <li key={x} className="flex items-center gap-4 bg-base/85 px-6 py-4">
                <span aria-hidden className="w-3 text-faint">
                  {i ? "+" : ""}
                </span>
                <span className="text-lg font-light">{x}</span>
              </li>
            ))}
          </ul>
          <span aria-hidden className="self-center justify-self-center text-3xl font-extralight text-accent md:px-4">
            <span className="hidden md:inline">→</span>
            <span className="md:hidden">↓</span>
          </span>
          <TechCard className="flex items-end p-7 md:p-10">
            <p className="text-[clamp(1.9rem,3.6vw,2.9rem)] font-light leading-[1.05] tracking-[-0.025em] text-accent">{b.flow.output}</p>
          </TechCard>
        </div>
      )}
      {b.training && (
        <TechCard className="grid gap-4 p-7 md:grid-cols-12 md:p-10">
          <p className="label md:col-span-3">{b.training.label}</p>
          <p className="text-[clamp(1.25rem,2.2vw,1.75rem)] font-light leading-snug md:col-span-9">{b.training.text}</p>
        </TechCard>
      )}
      {b.body.map((l) => (
        <p key={l} className="text-lg font-light text-muted">
          {l}
        </p>
      ))}
    </div>
  );
}

function Verdict({ b }: { b: BlockOf<"verdict"> }) {
  return (
    <div className="grid gap-24">
      {b.budget && (
        <div>
          <p className="text-[clamp(3.6rem,13vw,11rem)] font-extralight leading-[0.9] tracking-[-0.05em] text-accent">
            <CountUp raw={b.budget.value} duration={2.4} />
          </p>
          {b.budget.label && <p className="mt-6 text-[clamp(1.4rem,3vw,2.4rem)] font-light tracking-[-0.02em]">{b.budget.label}</p>}
        </div>
      )}
      {b.points.length > 0 && (
        <ul>
          {b.points.map((p, i) => (
            <li key={p + i} className="border-t border-line py-5 text-[clamp(1.1rem,1.8vw,1.4rem)] font-light">
              <Reveal delay={i * 0.08} y={12}>
                {p}
              </Reveal>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlockView({ block }: { block: Block }) {
  const body = (() => {
    switch (block.kind) {
      case "objective":
        return <Objective b={block} />;
      case "investment":
        return <Investment b={block} />;
      case "usecases":
        return <UseCases b={block} />;
      case "workflow":
        return <Workflow b={block} />;
      case "efficiency":
        return <Efficiency b={block} />;
      case "action_plan":
        return <ActionPlan b={block} />;
      case "verdict":
        return <Verdict b={block} />;
      default:
        return null; // hero is rendered by <Hero>
    }
  })();
  return (
    <>
      {body}
      <NoteCards cards={block.cards} />
    </>
  );
}
