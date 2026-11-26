/**
 * Pure parser: Google Slides `presentations.get` JSON -> typed Deck.
 * No I/O here, so it is fully unit-testable (see tests/parser.test.ts).
 *
 * Rules
 * - Slide order = page order. Printed footer numbers are ignored.
 * - Slides marked hidden ("Skip slide") never render.
 * - Speaker notes are the explicit schema: one `key: value` per line. A key
 *   present in the notes overrides what is inferred from the visible text.
 * - Without notes, the section is inferred from the visible kicker
 *   ("01 · OBJECTIVE"). A full-bleed image slide without a kicker is the hero
 *   (first one) or a chapter "plate" (divider) for the next chapter.
 * - Unknown sections are ignored and reported in `warnings`.
 */
import {
  BlockSchema,
  DeckSchema,
  SECTIONS,
  type Block,
  type Card,
  type Chapter,
  type Deck,
  type DeckImage,
  type Plate,
  type Section,
} from "./schema";
import { PERCENT_RE, RUPIAH_RE } from "./numbers";

// ---------------------------------------------------------------------------
// Minimal Slides API types (only what we read)
// ---------------------------------------------------------------------------
interface Dim {
  magnitude?: number;
}
interface TextElement {
  paragraphMarker?: { bullet?: { nestingLevel?: number } };
  textRun?: { content?: string };
  autoText?: { content?: string };
}
interface TextContent {
  textElements?: TextElement[];
}
export interface SlidesPageElement {
  objectId: string;
  title?: string;
  description?: string;
  size?: { width?: Dim; height?: Dim };
  transform?: { scaleX?: number; scaleY?: number; translateX?: number; translateY?: number };
  shape?: { text?: TextContent };
  image?: { contentUrl?: string; sourceUrl?: string };
  elementGroup?: { children?: SlidesPageElement[] };
  table?: { tableRows?: { tableCells?: { text?: TextContent }[] }[] };
}
export interface SlidesPage {
  objectId: string;
  pageElements?: SlidesPageElement[];
  slideProperties?: {
    isSkipped?: boolean;
    notesPage?: {
      notesProperties?: { speakerNotesObjectId?: string };
      pageElements?: SlidesPageElement[];
    };
  };
}
export interface SlidesPresentation {
  presentationId: string;
  title?: string;
  revisionId?: string;
  pageSize?: { width?: Dim; height?: Dim };
  slides?: SlidesPage[];
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------
export const clean = (s: string) =>
  s
    .replace(/[\t  ]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();

const FOOTER_RE = /^K-GROUP\s*\/\s*MARRAKESH AI RESEARCH LAB/i;
const KICKER_RE = /^(\d{1,2})\s*[·•]\s*(\S.*)$/;
const ARROW_SPLIT = /\s*(?:→|->|➝|⟶)\s*/;

function textOf(t?: TextContent): string[] {
  if (!t?.textElements) return [];
  let buf = "";
  for (const el of t.textElements) buf += el.textRun?.content ?? el.autoText?.content ?? "";
  return buf.split(/[\n\u000b]/).map(clean);
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
function box(el: SlidesPageElement): Box {
  const t = el.transform ?? {};
  return {
    x: t.translateX ?? 0,
    y: t.translateY ?? 0,
    w: (el.size?.width?.magnitude ?? 0) * Math.abs(t.scaleX ?? 1),
    h: (el.size?.height?.magnitude ?? 0) * Math.abs(t.scaleY ?? 1),
  };
}

function flatten(els: SlidesPageElement[] = []): SlidesPageElement[] {
  return els.flatMap((e) => (e.elementGroup ? flatten(e.elementGroup.children) : [e]));
}

interface SlideContent {
  lines: string[];
  images: { el: SlidesPageElement; areaRatio: number }[];
}

/** Lines in reading order: top-to-bottom, then left-to-right (row tolerance 2% of height). */
function readSlide(page: SlidesPage, pageW: number, pageH: number): SlideContent {
  const els = flatten(page.pageElements);
  const tol = pageH * 0.02;
  const sorted = [...els].sort((a, b) => {
    const A = box(a);
    const B = box(b);
    return Math.abs(A.y - B.y) > tol ? A.y - B.y : A.x - B.x;
  });
  const lines: string[] = [];
  const images: SlideContent["images"] = [];
  for (const el of sorted) {
    if (el.image?.contentUrl) {
      const b = box(el);
      images.push({ el, areaRatio: pageW && pageH ? (b.w * b.h) / (pageW * pageH) : 0 });
    } else if (el.shape?.text) {
      lines.push(...textOf(el.shape.text));
    } else if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        const cells = (row.tableCells ?? []).map((c) => textOf(c.text).filter(Boolean).join(" "));
        if (cells.some(Boolean)) lines.push(clean(cells.join(" ")));
      }
    }
  }
  return { lines: lines.filter((l) => l && !FOOTER_RE.test(l) && !/^\d{1,3}$/.test(l)), images };
}

// ---------------------------------------------------------------------------
// Speaker notes: `key: value` per line. Repeated keys accumulate.
// ---------------------------------------------------------------------------
export type Notes = Map<string, string[]>;

export function parseNotes(page: SlidesPage): Notes {
  const np = page.slideProperties?.notesPage;
  const id = np?.notesProperties?.speakerNotesObjectId;
  const el = np?.pageElements?.find((e) => e.objectId === id);
  const notes: Notes = new Map();
  for (const line of textOf(el?.shape?.text)) {
    const m = line.match(/^([A-Za-z][A-Za-z _-]{0,30})\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase().replace(/[\s-]+/g, "_");
    const val = clean(m[2]);
    if (!val) continue;
    notes.set(key, [...(notes.get(key) ?? []), val]);
  }
  return notes;
}

const one = (n: Notes, k: string) => n.get(k)?.[0];
const many = (n: Notes, k: string) => n.get(k);
const pipes = (s: string) => s.split("|").map(clean);

// ---------------------------------------------------------------------------
// Section detection
// ---------------------------------------------------------------------------
const SECTION_ALIASES: Record<string, Section | "divider"> = {
  hero: "hero",
  cover: "hero",
  objective: "objective",
  investment: "investment",
  investment_proposal: "investment",
  usecases: "usecases",
  use_cases: "usecases",
  use_case: "usecases",
  workflow: "workflow",
  efficiency: "efficiency",
  action_plan: "action_plan",
  actionplan: "action_plan",
  verdict: "verdict",
  divider: "divider",
  plate: "divider",
};

export function normalizeSection(raw: string): Section | "divider" | null {
  const k = raw.trim().toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  return SECTION_ALIASES[k] ?? null;
}

function sectionFromKickerLabel(label: string): Section | null {
  const u = label.toUpperCase();
  if (u.includes("OBJECTIVE")) return "objective";
  if (u.includes("INVESTMENT")) return "investment";
  if (u.includes("USE CASE")) return "usecases";
  if (u.includes("WORKFLOW")) return "workflow";
  if (u.includes("EFFICIENCY")) return "efficiency";
  if (u.includes("ACTION PLAN")) return "action_plan";
  if (u.includes("VERDICT")) return "verdict";
  return null;
}

const isPipelineLine = (l: string) => l.split(ARROW_SPLIT).filter(Boolean).length >= 3;

// ---------------------------------------------------------------------------
// Block builders. Each receives content lines (kicker removed) and notes.
// ---------------------------------------------------------------------------
type Ctx = { lines: string[]; notes: Notes; warn: (m: string) => void; slideId: string };
type Partial_ = Record<string, unknown>;

const splitDots = (l: string) => l.split(/\s+·\s+/).map(clean).filter(Boolean);
const stripColon = (s: string) => s.replace(/\s*:\s*$/, "").trim();

function heroBlock({ lines, notes }: Ctx): Partial_ {
  return {
    title: one(notes, "title") ?? lines[0],
    subtitle: many(notes, "subtitle") ?? lines.slice(1),
  };
}

function objectiveBlock({ lines, notes }: Ctx): Partial_ {
  const pillars: string[] = [];
  const roles: { team: string; role: string }[] = [];
  for (const l of lines.slice(1)) {
    const role = l.match(/^([^:·]{1,40}):\s*(.+)$/);
    if (role) roles.push({ team: clean(role[1]), role: clean(role[2]) });
    else pillars.push(...splitDots(l));
  }
  return {
    pillars: many(notes, "pillar")?.flatMap(splitDots) ?? pillars,
    roles:
      many(notes, "role")?.map((r) => {
        const [team, role] = pipes(r);
        return { team, role };
      }) ?? roles,
  };
}

function investmentBlock({ lines, notes, warn }: Ctx): Partial_ {
  const stages: { label: string; value: string; unit?: string }[] = [];
  const teams: { name: string; total?: string; items: { name: string; amount: string; note?: string }[] }[] = [];
  let reduction: { label: string; value: string } | undefined;
  let saving: { label: string; value: string } | undefined;
  let allocationLabel: string | undefined;
  const rest = lines.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const l = rest[i];
    const next = rest[i + 1] ?? "";
    const after = rest[i + 2] ?? "";
    const team = l.match(/^(.+?)\s*·\s*Total\s*:?\s*(Rp\s?[\d.,]+.*)$/i);
    const item = l.match(/^(.+?)\s+(\d{1,3}(?:\.\d{3})+)\s*(.*)$/);
    if (/allocation/i.test(l) && !team) {
      allocationLabel = l;
    } else if (team) {
      teams.push({ name: clean(team[1]), total: clean(team[2]), items: [] });
    } else if (item && teams.length && !RUPIAH_RE.test(l)) {
      const note = clean(item[3]).replace(/^\((.*)\)$/, "$1");
      teams[teams.length - 1].items.push({ name: clean(item[1]), amount: item[2], ...(note ? { note } : {}) });
    } else if (!RUPIAH_RE.test(l) && !PERCENT_RE.test(l) && RUPIAH_RE.test(next) && /^per\b/i.test(after)) {
      stages.push({ label: stripColon(l), value: next, unit: after });
      i += 2;
    } else if (!RUPIAH_RE.test(l) && PERCENT_RE.test(next)) {
      reduction = { label: stripColon(l), value: next };
      i += 1;
    } else if (!RUPIAH_RE.test(l) && RUPIAH_RE.test(next)) {
      saving = { label: stripColon(l), value: next };
      i += 1;
    } else {
      warn(`investment: unparsed line "${l}"`);
    }
  }
  const noteTeams = many(notes, "team");
  const noteItems = many(notes, "item");
  let finalTeams = teams;
  if (noteTeams) {
    finalTeams = noteTeams.map((t) => {
      const [name, total] = pipes(t);
      return { name, total, items: [] };
    });
  }
  if (noteItems) {
    finalTeams.forEach((t) => (t.items = []));
    for (const it of noteItems) {
      const [teamName, name, amount, note] = pipes(it);
      let t = finalTeams.find((x) => x.name.toLowerCase() === teamName.toLowerCase());
      if (!t) finalTeams.push((t = { name: teamName, items: [] }));
      t.items.push({ name, amount, ...(note ? { note } : {}) });
    }
  }
  const stat = (k: string) => {
    const v = one(notes, k);
    if (!v) return undefined;
    const [label, value] = pipes(v);
    return { label, value };
  };
  return {
    stages:
      many(notes, "stage")?.map((s) => {
        const [label, value, unit] = pipes(s);
        return { label, value, ...(unit ? { unit } : {}) };
      }) ?? stages,
    allocationLabel: one(notes, "allocation") ?? allocationLabel,
    teams: finalTeams,
    reduction: stat("reduction") ?? reduction,
    saving: stat("saving") ?? saving,
  };
}

function useCasesBlock({ lines, notes }: Ctx): Partial_ {
  const head = lines[0] ?? "";
  let team: string | undefined;
  let headline = head;
  if (/:\s*$/.test(head)) {
    team = stripColon(head);
    headline = team;
  } else if (head.includes(":")) {
    team = clean(head.split(":")[0]);
  }
  let target: { count: string; label: string } | undefined;
  const outputs: { count: string; label: string; meta: string[] }[] = [];
  const supporting: { name: string; desc: string }[] = [];
  const cases: string[] = [];
  let supportingTitle: string | undefined;
  let mode: "main" | "support" = "main";
  for (const l of lines.slice(1)) {
    const out = l.match(/^(\d[\d.]*)\s+(.+?)\s+[—–]\s+(.+)$/);
    const tgt = l.match(/^(\d[\d.]*)\s+(.+)$/);
    if (/support/i.test(l) && !l.includes(":")) {
      supportingTitle = l;
      mode = "support";
    } else if (mode === "support" && l.includes(":")) {
      for (const part of l.split(/\s+·\s+/)) {
        const [name, ...d] = part.split(":");
        supporting.push({ name: clean(name), desc: clean(d.join(":")) });
      }
    } else if (out) {
      outputs.push({ count: out[1], label: clean(out[2]), meta: splitDots(out[3]) });
    } else if (tgt && !target && !outputs.length) {
      target = { count: tgt[1], label: clean(tgt[2]) };
    } else {
      cases.push(...splitDots(l));
    }
  }
  const nt = one(notes, "target");
  return {
    headline: one(notes, "headline") ?? headline,
    team: one(notes, "team") ?? team,
    target: nt ? (([count, label]) => ({ count, label }))(pipes(nt)) : target,
    outputs:
      many(notes, "output")?.map((o) => {
        const [count, label, meta] = pipes(o);
        return { count, label, meta: meta ? splitDots(meta) : [] };
      }) ?? outputs,
    supportingTitle: one(notes, "supporting_title") ?? supportingTitle,
    supporting:
      many(notes, "support")?.map((s) => {
        const [name, desc] = pipes(s);
        return { name, desc: desc ?? "" };
      }) ?? supporting,
    cases: many(notes, "case") ?? cases,
  };
}

function workflowBlock({ lines, notes }: Ctx): Partial_ {
  const pipelines: { team: string; steps: string[] }[] = [];
  let label: string | undefined;
  for (const l of lines.slice(1)) {
    const inline = l.match(/^([^:→]{1,40}):\s*(.+)$/);
    if (inline && isPipelineLine(inline[2])) {
      pipelines.push({ team: clean(inline[1]), steps: inline[2].split(ARROW_SPLIT).map(clean).filter(Boolean) });
    } else if (isPipelineLine(l)) {
      pipelines.push({ team: label ?? `Pipeline ${pipelines.length + 1}`, steps: l.split(ARROW_SPLIT).map(clean).filter(Boolean) });
      label = undefined;
    } else if (/:\s*$/.test(l)) {
      label = stripColon(l);
    }
  }
  return {
    pipelines:
      many(notes, "pipeline")?.map((p) => {
        const [team, steps] = pipes(p);
        return { team, steps: (steps ?? "").split(ARROW_SPLIT).map(clean).filter(Boolean) };
      }) ?? pipelines,
  };
}

function efficiencyBlock({ lines, notes }: Ctx): Partial_ {
  const principles: string[] = [];
  const tiers: { level: string; use: string }[] = [];
  const body: string[] = [];
  let tiersLabel: string | undefined;
  for (const l of lines.slice(1)) {
    const tier = l.match(/^([A-Z][A-Z ]{1,20})\s*:\s*(.+)$/);
    if (tier) tiers.push({ level: clean(tier[1]), use: clean(tier[2]) });
    else if (/:\s*$/.test(l)) tiersLabel = stripColon(l);
    else if (l.includes(" · ")) principles.push(...splitDots(l));
    else body.push(l);
  }
  return {
    principles: many(notes, "principle")?.flatMap(splitDots) ?? principles,
    tiersLabel: one(notes, "tiers_label") ?? tiersLabel,
    tiers:
      many(notes, "tier")?.map((t) => {
        const [level, use] = pipes(t);
        return { level, use: use ?? "" };
      }) ?? tiers,
    body: many(notes, "body") ?? body,
  };
}

function actionPlanBlock({ lines, notes }: Ctx): Partial_ {
  let lab: string | undefined;
  let promptLabel: string | undefined;
  let prompts: string[] = [];
  let flow: { inputs: string[]; output: string } | undefined;
  let training: { label: string; text: string } | undefined;
  const body: string[] = [];
  for (const l of lines.slice(1)) {
    const prompt = l.match(/^(prompt[^:]*)\s*:\s*(.+)$/i);
    const train = l.match(/^(training[^:]*)\s*:\s*(.+)$/i);
    if (prompt) {
      promptLabel = clean(prompt[1]);
      prompts = prompt[2].split(",").map(clean).filter(Boolean);
    } else if (train) {
      training = { label: clean(train[1]), text: clean(train[2]) };
    } else if (l.includes("+") && ARROW_SPLIT.test(l)) {
      const [left, right] = l.split(ARROW_SPLIT);
      flow = { inputs: left.split("+").map(clean).filter(Boolean), output: clean(right ?? "") };
    } else if (!lab && /\blab\b/i.test(l)) {
      lab = l;
    } else {
      body.push(l);
    }
  }
  const nf = one(notes, "flow");
  const nt = one(notes, "training");
  return {
    lab: one(notes, "lab") ?? lab,
    promptLabel: one(notes, "prompt_label") ?? promptLabel,
    prompts: many(notes, "prompt")?.flatMap((p) => p.split(",").map(clean).filter(Boolean)) ?? prompts,
    flow: nf
      ? (() => {
          const [left, right] = nf.split(ARROW_SPLIT);
          return { inputs: left.split("+").map(clean), output: clean(right ?? "") };
        })()
      : flow,
    training: nt ? (([label, text]) => ({ label, text: text ?? "" }))(pipes(nt)) : training,
    body: many(notes, "body") ?? body,
  };
}

function verdictBlock({ lines, notes }: Ctx): Partial_ {
  const head = lines[0] ?? "";
  const m = head.match(/^(Rp\s?[\d.,]+(?:\s?(?:rb|ribu|jt|juta|m|miliar|t|triliun)\b)?)\s+(.+)$/i);
  const rest = lines.slice(1);
  const closingFromText = rest.length > 1 ? rest[rest.length - 1] : undefined;
  const nb = one(notes, "budget");
  return {
    budget: nb ? (([value, label]) => ({ value, label: label ?? "" }))(pipes(nb)) : m ? { value: clean(m[1]), label: clean(m[2]) } : undefined,
    points: many(notes, "point") ?? (closingFromText ? rest.slice(0, -1) : rest),
    closing: one(notes, "closing") ?? closingFromText,
  };
}

const BUILDERS: Record<Section, (c: Ctx) => Partial_> = {
  hero: heroBlock,
  objective: objectiveBlock,
  investment: investmentBlock,
  usecases: useCasesBlock,
  workflow: workflowBlock,
  efficiency: efficiencyBlock,
  action_plan: actionPlanBlock,
  verdict: verdictBlock,
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
const PLATE_MIN_AREA = 0.4;

function toImage(slideId: string, el: SlidesPageElement, notes: Notes): DeckImage {
  return {
    key: `${slideId}:${el.objectId}`,
    url: el.image!.contentUrl!,
    alt: one(notes, "alt") ?? clean(el.description ?? el.title ?? ""),
    ...(one(notes, "focus") ? { focus: one(notes, "focus") } : {}),
    ...(/^(left|right|top)$/i.test(one(notes, "align") ?? "") ? { textSide: one(notes, "align")!.toLowerCase() as "left" | "right" | "top" } : {}),
  };
}

function cardsFrom(notes: Notes): Card[] {
  return (many(notes, "card") ?? []).map((c) => {
    const [label, value, note] = pipes(c);
    return { label, value: value ?? "", ...(note ? { note } : {}) };
  });
}

const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function parseDeck(p: SlidesPresentation): Deck {
  const warnings: string[] = [];
  const pageW = p.pageSize?.width?.magnitude ?? 9144000;
  const pageH = p.pageSize?.height?.magnitude ?? 5143500;
  const chapters: Chapter[] = [];
  let pendingPlate: Plate | undefined;
  let heroDone = false;

  (p.slides ?? []).forEach((slide, index) => {
    const where = `slide ${index + 1} (${slide.objectId})`;
    const warn = (m: string) => warnings.push(`${where}: ${m}`);
    if (slide.slideProperties?.isSkipped) return; // hidden slides never render

    const notes = parseNotes(slide);
    const { lines: allLines, images } = readSlide(slide, pageW, pageH);
    const kickerIdx = allLines.findIndex((l) => KICKER_RE.test(l) && l === l.toUpperCase());
    const kicker = one(notes, "kicker") ?? (kickerIdx >= 0 ? allLines[kickerIdx] : undefined);
    const lines = allLines.filter((_, i) => i !== kickerIdx);
    const plateImage = images.find((i) => i.areaRatio >= PLATE_MIN_AREA);
    const inlineImage = images.find((i) => i.areaRatio < PLATE_MIN_AREA);

    // 1. Decide the section
    let section: Section | "divider" | null = null;
    const declared = one(notes, "section");
    if (declared) {
      section = normalizeSection(declared);
      if (!section) return warn(`unknown section "${declared}" — slide ignored`);
    } else if (kickerIdx >= 0) {
      const label = allLines[kickerIdx].match(KICKER_RE)![2];
      section = sectionFromKickerLabel(label);
      if (!section) return warn(`unknown kicker "${allLines[kickerIdx]}" — slide ignored`);
      if (lines.filter(isPipelineLine).length >= 2) section = "workflow";
    } else if (plateImage && lines.length <= 4) {
      section = heroDone ? "divider" : "hero";
    } else {
      return warn("no section key, no kicker and no full-bleed image — slide ignored");
    }

    // 2. Divider: becomes the cinematic plate of the next chapter
    if (section === "divider") {
      const title = (many(notes, "title") ?? lines).filter(Boolean);
      pendingPlate = {
        title,
        ...(plateImage ? { image: toImage(slide.objectId, plateImage.el, notes) } : {}),
      };
      return;
    }

    // 3. Content block
    const ctx: Ctx = { lines, notes, warn, slideId: slide.objectId };
    const built = BUILDERS[section](ctx);
    const imgSource = section === "hero" ? plateImage ?? inlineImage : inlineImage ?? plateImage;
    const candidate = {
      kind: section,
      slideId: slide.objectId,
      kicker,
      headline: one(notes, "headline") ?? lines[0],
      cards: cardsFrom(notes),
      ...(imgSource ? { image: toImage(slide.objectId, imgSource.el, notes) } : {}),
      ...built,
    };
    const parsed = BlockSchema.safeParse(candidate);
    if (!parsed.success) {
      return warn(`invalid ${section} block — dropped (${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")})`);
    }
    const block: Block = parsed.data;
    if (section === "hero") heroDone = true;

    const last = chapters[chapters.length - 1];
    if (last && last.section === section && !pendingPlate) {
      last.blocks.push(block);
      return;
    }
    const sameCount = chapters.filter((c) => c.section === section).length;
    const plate: Plate | undefined = pendingPlate;
    pendingPlate = undefined;
    chapters.push({
      id: sameCount ? `${section}-${sameCount + 1}` : section,
      section,
      kicker: block.kicker,
      headline: plate?.title.length ? plate.title.join(" ") : block.headline,
      ...(plate ? { plate } : {}),
      blocks: [block],
    });
  });

  if (pendingPlate) warnings.push("deck ends with a divider slide — no chapter to attach it to");

  // Hide a block headline that only repeats the chapter headline.
  for (const c of chapters) {
    for (const b of c.blocks) if (b.kind !== "hero" && norm(b.headline) === norm(c.headline)) b.headline = undefined;
  }

  return DeckSchema.parse({
    presentationId: p.presentationId,
    title: p.title ?? "",
    revisionId: p.revisionId,
    chapters,
    warnings,
  });
}

export { SECTIONS };
