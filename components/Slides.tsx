import type { ReactNode } from "react";
import type { BlockOf, Card, Chapter, Deck } from "@/lib/schema";
import { CountUp } from "./CountUp";
import { DeckImg } from "./DeckImg";
import { Plate } from "./Plate";
import { Reveal } from "./Reveal";
import { StageBars } from "./StageBars";
import { TechCard } from "./TechCard";
import { Hero } from "./Hero";
import { Closing as ClosingLine } from "./Closing";

/**
 * Turns the parsed deck into slides. One deck block can become more than one
 * slide when it carries more than fits a screen (e.g. investment: figures,
 * savings, tool tables). Every word comes from the deck.
 */
export interface Frame {
  id: string;
  label: string; // for the slide's accessible name
  node: ReactNode;
  preload: string[]; // image URLs to warm up before this slide shows
}

const pad = (n: number) => String(n + 1).padStart(2, "0");

/** Standard slide frame: fills the viewport, content vertically centred, scrolls inside on small screens. */
function Slide({ kicker, title, children, wide = false }: { kicker?: string; title?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div data-slide-scroll className="h-full w-full overflow-y-auto overscroll-contain">
      <div
        className={`mx-auto flex min-h-full w-full flex-col justify-center px-5 pb-28 pt-24 md:px-[6vw] md:pb-[14vh] md:pt-[13vh] ${
          wide ? "max-w-[1680px]" : "max-w-[1440px]"
        }`}
      >
        {(kicker || title) && (
          <header className="mb-[clamp(1.75rem,5vh,3.5rem)]">
            {kicker && <p className="kicker mb-4">{kicker}</p>}
            {title && (
              <h2 className="max-w-[24ch] text-[clamp(1.9rem,min(4.2vw,7vh),4rem)] font-normal leading-[1.04] tracking-[-0.025em] text-text [text-wrap:balance]">
                {title}
              </h2>
            )}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

/** Numbered terms separated by hairlines. */
function IndexGrid({ items, cols = 3 }: { items: string[]; cols?: 2 | 3 }) {
  return (
    <ol className={`grid gap-x-10 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""}`}>
      {items.map((item, i) => (
        <li key={item + i} className="flex items-baseline gap-5 border-t border-line py-[clamp(0.9rem,2.2vh,1.5rem)]">
          <span className="num w-7 shrink-0 text-sm font-semibold tracking-[0.1em] text-accent">{pad(i)}</span>
          <Reveal delay={0.1 + i * 0.06} y={12}>
            <span className="text-[clamp(1.2rem,min(1.9vw,3.2vh),1.85rem)] font-light leading-snug text-text">{item}</span>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

function NoteCards({ cards }: { cards: Card[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c, i) => (
        <TechCard key={c.label + i} delay={i * 0.15} className="p-7">
          <p className="label">{c.label}</p>
          <p className="num mt-5 text-4xl font-light tracking-[-0.02em] text-text">{c.value}</p>
          {c.note && <p className="mt-2 text-base text-muted">{c.note}</p>}
        </TechCard>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section slides
// ---------------------------------------------------------------------------

function objectiveSlides(c: Chapter, b: BlockOf<"objective">): Omit<Frame, "id">[] {
  return [
    {
      label: c.kicker ?? "Objective",
      preload: [],
      node: (
        <Slide kicker={c.kicker} title={b.headline}>
          <div className="grid gap-[clamp(2rem,6vh,4.5rem)]">
            {b.pillars.length > 0 && <IndexGrid items={b.pillars} />}
            {b.roles.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {b.roles.map((r, i) => (
                  <TechCard key={r.team} delay={0.3 + i * 0.25} className="p-7 md:p-9">
                    <p className="label">{r.team}</p>
                    <p className="mt-[clamp(1.25rem,4vh,2.5rem)] text-[clamp(1.75rem,min(3.4vw,5.5vh),3.2rem)] font-light leading-[1.05] tracking-[-0.025em] text-text">
                      {r.role}
                    </p>
                  </TechCard>
                ))}
              </div>
            )}
          </div>
        </Slide>
      ),
    },
  ];
}

function investmentSlides(c: Chapter, b: BlockOf<"investment">): Omit<Frame, "id">[] {
  const out: Omit<Frame, "id">[] = [];
  if (b.stages.length) {
    out.push({
      label: `${c.kicker ?? "Investment"} · ${b.stages.map((s) => s.label).join(", ")}`,
      preload: [],
      node: (
        <Slide kicker={c.kicker} title={b.headline}>
          <StageBars stages={b.stages} />
        </Slide>
      ),
    });
  }
  const stats = [b.reduction, b.saving].filter(Boolean) as { label: string; value: string }[];
  if (stats.length) {
    out.push({
      label: stats.map((s) => s.label).join(", "),
      preload: [],
      node: (
        <Slide kicker={c.kicker}>
          <div className="grid gap-4 md:grid-cols-2">
            {stats.map((s, i) => (
              <TechCard key={s.label} delay={i * 0.25} className="flex flex-col justify-between p-7 md:min-h-[38vh] md:p-10">
                <p className="label">{s.label}</p>
                <p className="mt-10 text-[clamp(3.25rem,min(7.5vw,13vh),8rem)] font-extralight leading-none tracking-[-0.04em] text-accent">
                  <CountUp raw={s.value} duration={2} />
                </p>
              </TechCard>
            ))}
          </div>
        </Slide>
      ),
    });
  }
  if (b.teams.length) {
    out.push({
      label: b.allocationLabel ?? b.teams.map((t) => t.name).join(", "),
      preload: [],
      node: (
        <Slide kicker={c.kicker} title={b.allocationLabel}>
          <div className="grid gap-4 md:grid-cols-2">
            {b.teams.map((t, ti) => (
              <TechCard key={t.name} delay={ti * 0.25} className="overflow-hidden">
                <table className="w-full text-left text-[clamp(1rem,min(1.15vw,2.1vh),1.2rem)]">
                  <caption className="sr-only">
                    {t.name} {t.total}
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="px-6 py-[clamp(0.8rem,2vh,1.25rem)] text-[1.35em] font-medium text-text md:px-8">
                        {t.name}
                      </th>
                      <th scope="col" className="px-6 md:px-8">
                        <span className="sr-only">Amount</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.items.map((it) => (
                      <tr key={it.name} className="border-b border-line last:border-0">
                        <th scope="row" className="px-6 py-[clamp(0.6rem,1.6vh,1rem)] font-normal text-text md:px-8">
                          {it.name}
                          {it.note && <span className="mt-0.5 block text-[0.85em] text-faint">{it.note}</span>}
                        </th>
                        <td className="num whitespace-nowrap px-6 text-right text-muted md:px-8">{it.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                  {t.total && (
                    <tfoot>
                      <tr className="border-t border-line-strong bg-raised/70">
                        <th scope="row" className="label px-6 py-[clamp(0.8rem,2vh,1.25rem)] md:px-8">
                          Total
                        </th>
                        <td className="num whitespace-nowrap px-6 text-right text-[1.25em] font-medium text-text md:px-8">{t.total}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </TechCard>
            ))}
          </div>
        </Slide>
      ),
    });
  }
  return out;
}

function useCaseSlides(c: Chapter, b: BlockOf<"usecases">): Omit<Frame, "id">[] {
  const out: Omit<Frame, "id">[] = [];
  const title = b.headline ?? b.team;
  if (b.target || b.outputs.length) {
    out.push({
      label: title ?? "Use cases",
      preload: [],
      node: (
        <Slide kicker={c.kicker} title={title}>
          <div className="grid items-end gap-[clamp(1.5rem,5vh,3rem)] lg:grid-cols-12 lg:gap-12">
            {b.target && (
              <div className="lg:col-span-5">
                <p className="text-[clamp(5rem,min(15vw,26vh),14rem)] font-extralight leading-[0.82] tracking-[-0.05em] text-text">
                  <CountUp raw={b.target.count} duration={2.2} />
                </p>
                <p className="mt-5 max-w-[26ch] text-[clamp(1.15rem,min(1.6vw,2.8vh),1.6rem)] font-light leading-snug text-muted">
                  {b.target.label}
                </p>
              </div>
            )}
            {b.outputs.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
                {b.outputs.map((o, i) => (
                  <TechCard key={o.label} delay={0.3 + i * 0.2} className="flex flex-col p-6">
                    <p className="num text-[clamp(2.5rem,min(4vw,7vh),4rem)] font-light leading-none tracking-[-0.03em] text-text">
                      <CountUp raw={o.count} />
                    </p>
                    <p className="mt-[clamp(1rem,4vh,2.5rem)] text-lg leading-snug text-text">{o.label}</p>
                    {o.meta.length > 0 && <p className="num mt-1.5 text-base text-faint">{o.meta.join(" · ")}</p>}
                  </TechCard>
                ))}
              </div>
            )}
          </div>
        </Slide>
      ),
    });
  }
  if (b.supporting.length) {
    out.push({
      label: b.supportingTitle ?? "Supporting system",
      preload: [],
      node: (
        <Slide kicker={c.kicker} title={b.supportingTitle}>
          <dl>
            {b.supporting.map((s, i) => (
              <Reveal key={s.name} delay={0.1 + i * 0.08} y={12}>
                <div className="grid gap-1 border-t border-line py-[clamp(0.9rem,2.4vh,1.6rem)] md:grid-cols-12 md:gap-8">
                  <dt className="text-[clamp(1.15rem,min(1.6vw,2.8vh),1.6rem)] font-medium text-text md:col-span-4">{s.name}</dt>
                  <dd className="text-[clamp(1.05rem,min(1.4vw,2.5vh),1.4rem)] font-light text-muted md:col-span-8">{s.desc}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </Slide>
      ),
    });
  }
  if (b.cases.length) {
    out.push({
      label: title ?? "Use cases",
      preload: [],
      node: (
        <Slide kicker={c.kicker} title={title}>
          <IndexGrid items={b.cases} cols={2} />
        </Slide>
      ),
    });
  }
  return out;
}

function workflowSlides(c: Chapter, b: BlockOf<"workflow">): Omit<Frame, "id">[] {
  return [
    {
      label: b.pipelines.map((p) => p.team).join(", ") || "Workflow",
      preload: [],
      node: (
        <Slide kicker={c.kicker} title={b.headline}>
          <div className="grid gap-4">
            {b.pipelines.map((p, pi) => (
              <TechCard key={p.team + pi} delay={pi * 0.3} className="p-6 md:p-9">
                <p className="label mb-7">{p.team}</p>
                <ol className="pipeline-track relative grid gap-4 border-l border-line pl-6 md:flex md:gap-0 md:border-l-0 md:border-t md:pl-0 md:pt-7">
                  {p.steps.map((s, i) => {
                    const human = /human/i.test(s);
                    return (
                      <li key={s + i} className="relative md:flex-1 md:pr-4">
                        <span
                          aria-hidden
                          className={`absolute -left-[28.5px] top-2 h-2 w-2 rounded-full md:-top-[32.5px] md:left-0 ${
                            human ? "bg-accent shadow-[0_0_10px_var(--color-accent-glow)]" : "bg-text/50"
                          }`}
                        />
                        <span className="num block text-sm font-semibold tracking-[0.1em] text-faint">{pad(i)}</span>
                        <span className={`mt-1 block text-[clamp(1.05rem,min(1.35vw,2.4vh),1.4rem)] leading-snug ${human ? "text-accent" : "text-text"}`}>
                          {s}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </TechCard>
            ))}
          </div>
        </Slide>
      ),
    },
  ];
}

const TIER_FILL: Record<string, number> = { LOW: 1, BALANCED: 2, POWERFUL: 3 };

function efficiencySlides(c: Chapter, b: BlockOf<"efficiency">): Omit<Frame, "id">[] {
  const hasImage = Boolean(b.image?.src);
  return [
    {
      label: b.headline ?? c.kicker ?? "Efficiency",
      preload: hasImage ? [b.image!.srcSmall ?? b.image!.src!] : [],
      node: (
        <Slide kicker={c.kicker} title={b.headline} wide={hasImage}>
          <div className={hasImage ? "grid items-center gap-8 lg:grid-cols-12 lg:gap-12" : "grid gap-[clamp(2rem,5vh,3.5rem)]"}>
            <div className={hasImage ? "grid gap-6 lg:col-span-4" : "grid gap-[clamp(2rem,5vh,3.5rem)]"}>
              {b.principles.length > 0 && <IndexGrid items={b.principles} />}
              {b.tiers.length > 0 && (
                <div>
                  {b.tiersLabel && <p className="label mb-5">{b.tiersLabel}</p>}
                  <div className="grid gap-4 md:grid-cols-3">
                    {b.tiers.map((t, i) => {
                      const fill = TIER_FILL[t.level.toUpperCase()] ?? i + 1;
                      return (
                        <TechCard key={t.level} delay={0.3 + i * 0.2} className="p-6">
                          <div aria-hidden className="mb-[clamp(1.25rem,4vh,2.5rem)] flex gap-1.5">
                            {Array.from({ length: Math.max(3, b.tiers.length) }, (_, k) => (
                              <span key={k} className={`h-[3px] flex-1 rounded-full ${k < fill ? "bg-accent" : "bg-line-strong"}`} />
                            ))}
                          </div>
                          <p className="text-base font-semibold tracking-[0.16em] text-text">{t.level}</p>
                          <p className="mt-1.5 text-[clamp(1.1rem,min(1.5vw,2.6vh),1.5rem)] font-light text-muted">{t.use}</p>
                        </TechCard>
                      );
                    })}
                  </div>
                </div>
              )}
              {b.body.map((l) => (
                <p key={l} className="max-w-[46ch] text-[clamp(1.1rem,min(1.45vw,2.6vh),1.5rem)] font-light leading-relaxed text-muted">
                  {l}
                </p>
              ))}
            </div>
            {hasImage && (
              <TechCard as="figure" delay={0.3} className="overflow-hidden p-2 lg:col-span-8">
                <DeckImg
                  image={b.image!}
                  alt={b.image!.alt || b.headline || ""}
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="h-auto max-h-[52vh] w-full rounded-[4px] object-contain object-left-top"
                />
              </TechCard>
            )}
          </div>
        </Slide>
      ),
    },
  ];
}

function actionPlanSlides(c: Chapter, b: BlockOf<"action_plan">): Omit<Frame, "id">[] {
  const out: Omit<Frame, "id">[] = [];
  if (b.lab || b.prompts.length) {
    out.push({
      label: b.lab ?? b.promptLabel ?? "Action plan",
      preload: [],
      node: (
        <Slide kicker={c.kicker}>
          <div className="grid gap-[clamp(2rem,6vh,4rem)]">
            {b.lab && (
              <Reveal>
                <p className="max-w-[22ch] text-[clamp(2rem,min(4.6vw,8vh),4.5rem)] font-light leading-[1.04] tracking-[-0.03em] text-text [text-wrap:balance]">
                  {b.lab}
                </p>
              </Reveal>
            )}
            {b.prompts.length > 0 && (
              <div className="grid gap-5 md:grid-cols-12 md:gap-10">
                {b.promptLabel && <p className="label md:col-span-3 md:pt-5">{b.promptLabel}</p>}
                <ol className="grid grid-cols-2 gap-x-8 sm:grid-cols-3 md:col-span-9">
                  {b.prompts.map((p, i) => (
                    <li key={p} className="flex items-baseline gap-4 border-t border-line py-[clamp(0.7rem,1.9vh,1.2rem)]">
                      <span className="num text-sm font-semibold tracking-[0.1em] text-accent">{pad(i)}</span>
                      <span className="text-[clamp(1.1rem,min(1.6vw,2.8vh),1.6rem)] font-light text-text">{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </Slide>
      ),
    });
  }
  if (b.flow || b.training) {
    out.push({
      label: b.flow?.output ?? b.training?.label ?? "Action plan",
      preload: [],
      node: (
        <Slide kicker={c.kicker}>
          <div className="grid gap-[clamp(1.5rem,5vh,3rem)]">
            {b.flow && (
              <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
                <ul className="grid overflow-hidden rounded-[var(--radius-card)] border border-line">
                  {b.flow.inputs.map((x, i) => (
                    <li key={x} className="flex items-center gap-4 border-b border-line bg-surface/70 px-6 py-[clamp(0.8rem,2.2vh,1.4rem)] last:border-0">
                      <span aria-hidden className="w-4 text-xl text-accent">
                        {i ? "+" : ""}
                      </span>
                      <span className="text-[clamp(1.15rem,min(1.6vw,2.8vh),1.6rem)] font-light text-text">{x}</span>
                    </li>
                  ))}
                </ul>
                <span aria-hidden className="self-center justify-self-center text-4xl font-extralight text-accent md:px-4">
                  <span className="hidden md:inline">→</span>
                  <span className="md:hidden">↓</span>
                </span>
                <TechCard delay={0.4} className="flex items-end p-7 md:p-10">
                  <p className="text-[clamp(2rem,min(3.8vw,6.5vh),3.6rem)] font-light leading-[1.04] tracking-[-0.025em] text-accent">{b.flow.output}</p>
                </TechCard>
              </div>
            )}
            {b.training && (
              <TechCard delay={0.6} className="grid gap-4 p-7 md:grid-cols-12 md:p-9">
                <p className="label md:col-span-3 md:pt-1.5">{b.training.label}</p>
                <p className="text-[clamp(1.2rem,min(2vw,3.4vh),2rem)] font-light leading-snug text-text md:col-span-9">{b.training.text}</p>
              </TechCard>
            )}
            {b.body.map((l) => (
              <p key={l} className="text-xl font-light text-muted">
                {l}
              </p>
            ))}
          </div>
        </Slide>
      ),
    });
  }
  return out;
}

function verdictSlides(c: Chapter, b: BlockOf<"verdict">): Omit<Frame, "id">[] {
  const out: Omit<Frame, "id">[] = [
    {
      label: c.headline ?? c.kicker ?? "Verdict",
      preload: [],
      node: (
        <Slide kicker={c.kicker}>
          <h2 className="sr-only">{c.headline}</h2>
          <div className="grid items-end gap-[clamp(2rem,6vh,4rem)] lg:grid-cols-12 lg:gap-12">
            {b.budget && (
              <div className="lg:col-span-7">
                <p className="text-[clamp(3.6rem,min(11vw,20vh),11rem)] font-extralight leading-[0.88] tracking-[-0.05em] text-accent">
                  <CountUp raw={b.budget.value} duration={2.4} />
                </p>
                {b.budget.label && (
                  <p className="mt-5 text-[clamp(1.5rem,min(2.8vw,4.8vh),2.8rem)] font-light tracking-[-0.02em] text-text">{b.budget.label}</p>
                )}
              </div>
            )}
            {b.points.length > 0 && (
              <ul className="lg:col-span-5">
                {b.points.map((p, i) => (
                  <li key={p + i} className="border-t border-line py-[clamp(0.8rem,2.2vh,1.3rem)]">
                    <Reveal delay={0.4 + i * 0.1} y={10}>
                      <span className="text-[clamp(1.1rem,min(1.6vw,2.8vh),1.6rem)] font-light text-text">{p}</span>
                    </Reveal>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Slide>
      ),
    },
  ];
  if (b.closing) {
    out.push({
      label: b.closing,
      preload: [],
      node: (
        <div className="flex h-full items-center justify-center px-5">
          <ClosingLine line={b.closing} />
        </div>
      ),
    });
  }
  return out;
}


// ---------------------------------------------------------------------------

export function buildFrames(deck: Deck): Frame[] {
  const frames: Omit<Frame, "id">[] = [];
  for (const c of deck.chapters) {
    if (c.section === "hero") {
      const b = c.blocks[0] as BlockOf<"hero">;
      frames.push({ label: b.title, preload: b.image?.srcSmall ? [b.image.srcSmall] : [], node: <Hero b={b} /> });
      continue;
    }
    if (c.plate) {
      const img = c.plate.image;
      frames.push({
        label: c.plate.title.join(" "),
        preload: img?.srcSmall ? [img.srcSmall] : [],
        node: (
          <Plate plate={c.plate} kicker={c.kicker}>
            {img?.src && <DeckImg image={img} alt={img.alt} className="h-full w-full object-cover" />}
          </Plate>
        ),
      });
    }
    for (const b of c.blocks) {
      switch (b.kind) {
        case "objective":
          frames.push(...objectiveSlides(c, b));
          break;
        case "investment":
          frames.push(...investmentSlides(c, b));
          break;
        case "usecases":
          frames.push(...useCaseSlides(c, b));
          break;
        case "workflow":
          frames.push(...workflowSlides(c, b));
          break;
        case "efficiency":
          frames.push(...efficiencySlides(c, b));
          break;
        case "action_plan":
          frames.push(...actionPlanSlides(c, b));
          break;
        case "verdict":
          frames.push(...verdictSlides(c, b));
          break;
      }
      if (b.cards.length) {
        frames.push({
          label: b.cards.map((x) => x.label).join(", "),
          preload: [],
          node: (
            <Slide kicker={c.kicker}>
              <NoteCards cards={b.cards} />
            </Slide>
          ),
        });
      }
      // A block whose keys are all missing produces no slide (never an empty one).
    }
  }
  return frames.map((f, i) => ({ ...f, id: String(i + 1) }));
}
