import { z } from "zod";

/**
 * The content contract between the Google Slides deck and the website.
 * Every block is validated on its own: an invalid block is dropped and logged,
 * it never takes the page down.
 */

export const SECTIONS = [
  "hero",
  "objective",
  "investment",
  "usecases",
  "workflow",
  "efficiency",
  "action_plan",
  "verdict",
] as const;
export type Section = (typeof SECTIONS)[number];

const str = z.string().min(1);

/** An image found in the deck. `url` is the short-lived Google URL; `src*` are set once cached locally. */
export const ImageSchema = z.object({
  key: str,
  url: str,
  alt: z.string(),
  focus: z.string().optional(),
  /** Where a title over this image is calmest (lower left, lower right, or the top band). Notes `align:` wins; otherwise measured at cache time. */
  textSide: z.enum(["left", "right", "top"]).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  src: z.string().optional(),
  srcSmall: z.string().optional(),
});
export type DeckImage = z.infer<typeof ImageSchema>;

export const CardSchema = z.object({ label: str, value: z.string(), note: z.string().optional() });
export type Card = z.infer<typeof CardSchema>;

const base = {
  slideId: str,
  kicker: z.string().optional(),
  headline: z.string().optional(),
  cards: z.array(CardSchema).default([]),
  image: ImageSchema.optional(),
};

export const HeroBlock = z.object({
  ...base,
  kind: z.literal("hero"),
  title: str,
  subtitle: z.array(str).default([]),
});

export const ObjectiveBlock = z.object({
  ...base,
  kind: z.literal("objective"),
  pillars: z.array(str).default([]),
  roles: z.array(z.object({ team: str, role: str })).default([]),
});

export const StageSchema = z.object({ label: str, value: str, unit: z.string().optional() });
export const LineItemSchema = z.object({ name: str, amount: str, note: z.string().optional() });
export const TeamAllocationSchema = z.object({ name: str, total: z.string().optional(), items: z.array(LineItemSchema) });
export const StatSchema = z.object({ label: str, value: str });

export const InvestmentBlock = z.object({
  ...base,
  kind: z.literal("investment"),
  stages: z.array(StageSchema).default([]),
  allocationLabel: z.string().optional(),
  teams: z.array(TeamAllocationSchema).default([]),
  reduction: StatSchema.optional(),
  saving: StatSchema.optional(),
});

export const UseCasesBlock = z.object({
  ...base,
  kind: z.literal("usecases"),
  team: z.string().optional(),
  target: z.object({ count: str, label: str }).optional(),
  outputs: z.array(z.object({ count: str, label: str, meta: z.array(z.string()) })).default([]),
  supportingTitle: z.string().optional(),
  supporting: z.array(z.object({ name: str, desc: z.string() })).default([]),
  cases: z.array(str).default([]),
});

export const WorkflowBlock = z.object({
  ...base,
  kind: z.literal("workflow"),
  pipelines: z.array(z.object({ team: str, steps: z.array(str).min(2) })).default([]),
});

export const EfficiencyBlock = z.object({
  ...base,
  kind: z.literal("efficiency"),
  principles: z.array(str).default([]),
  tiersLabel: z.string().optional(),
  tiers: z.array(z.object({ level: str, use: str })).default([]),
  body: z.array(str).default([]),
});

export const ActionPlanBlock = z.object({
  ...base,
  kind: z.literal("action_plan"),
  lab: z.string().optional(),
  promptLabel: z.string().optional(),
  prompts: z.array(str).default([]),
  flow: z.object({ inputs: z.array(str), output: str }).optional(),
  training: z.object({ label: str, text: str }).optional(),
  body: z.array(str).default([]),
});

export const VerdictBlock = z.object({
  ...base,
  kind: z.literal("verdict"),
  budget: z.object({ value: str, label: z.string() }).optional(),
  points: z.array(str).default([]),
  closing: z.string().optional(),
});

export const BlockSchema = z.discriminatedUnion("kind", [
  HeroBlock,
  ObjectiveBlock,
  InvestmentBlock,
  UseCasesBlock,
  WorkflowBlock,
  EfficiencyBlock,
  ActionPlanBlock,
  VerdictBlock,
]);
export type Block = z.infer<typeof BlockSchema>;
export type BlockOf<K extends Block["kind"]> = Extract<Block, { kind: K }>;

export const PlateSchema = z.object({ title: z.array(str), image: ImageSchema.optional() });
export type Plate = z.infer<typeof PlateSchema>;

export const ChapterSchema = z.object({
  id: str,
  section: z.enum(SECTIONS),
  kicker: z.string().optional(),
  headline: z.string().optional(),
  plate: PlateSchema.optional(),
  blocks: z.array(BlockSchema).min(1),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const DeckSchema = z.object({
  presentationId: str,
  title: z.string(),
  revisionId: z.string().optional(),
  chapters: z.array(ChapterSchema).min(1),
  warnings: z.array(z.string()).default([]),
});
export type Deck = z.infer<typeof DeckSchema>;

export const SnapshotSchema = z.object({
  fetchedAt: z.string(),
  deck: DeckSchema,
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
