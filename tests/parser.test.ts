import { describe, expect, it } from "vitest";
import fixture from "../fixtures/deck.slides.json";
import { parseDeck, type SlidesPresentation } from "../lib/parser";
import { formatLike, numericParts, parsePercent, parseRupiah } from "../lib/numbers";
import type { Block, BlockOf, Chapter } from "../lib/schema";

const deck = parseDeck(fixture as unknown as SlidesPresentation);
const chapter = (id: string) => deck.chapters.find((c) => c.id === id) as Chapter;
const block = <K extends Block["kind"]>(id: K, i = 0) => chapter(id).blocks[i] as BlockOf<K>;
const allText = JSON.stringify(deck);

describe("parseDeck — structure", () => {
  it("builds chapters in deck order", () => {
    expect(deck.chapters.map((c) => c.section)).toEqual([
      "hero",
      "objective",
      "investment",
      "usecases",
      "workflow",
      "efficiency",
      "action_plan",
      "verdict",
    ]);
  });

  it("never renders hidden slides", () => {
    expect(allText).not.toContain("HIDDEN SLIDE");
    expect(chapter("usecases").blocks).toHaveLength(2);
  });

  it("ignores unknown sections and reports them", () => {
    expect(allText).not.toContain("UNKNOWN SECTION");
    expect(deck.warnings.some((w) => w.includes('unknown section "roadmap"'))).toBe(true);
  });

  it("strips footers and their non-sequential slide numbers", () => {
    expect(allText).not.toContain("MARRAKESH AI RESEARCH LAB");
  });

  it("attaches divider slides as the next chapter's plate", () => {
    expect(chapter("objective").plate?.title).toEqual(["Why Do We Need AI?"]);
    expect(chapter("usecases").plate?.title).toEqual(["Use Case"]); // tabs collapsed
    expect(chapter("workflow").plate?.title).toEqual(["The Value Is in the Workflow", "Not the Tools"]);
    expect(chapter("verdict").plate).toBeUndefined();
    for (const id of ["objective", "investment", "usecases", "workflow", "efficiency", "action_plan"]) {
      expect(chapter(id).plate?.image?.url).toMatch(/^fixture:/);
    }
  });

  it("detects the workflow slide even though its kicker says EFFICIENCY", () => {
    expect(chapter("workflow").kicker).toBe("04 · EFFICIENCY");
  });
});

describe("parseDeck — content", () => {
  it("hero", () => {
    const b = block("hero");
    expect(b.title).toBe("K-GROUP AI OPTIMIZATION");
    expect(b.subtitle).toEqual(["Business Development × Marrakesh Creative Powerhouse"]);
    expect(b.image?.url).toBe("fixture:cover.jpg");
  });

  it("objective", () => {
    const b = block("objective");
    expect(b.pillars).toHaveLength(6);
    expect(b.roles).toEqual([
      { team: "BD", role: "Intelligence to Strategy" },
      { team: "Marrakesh", role: "Idea to Production" },
    ]);
  });

  it("investment keeps money as raw display strings", () => {
    const b = block("investment");
    expect(b.stages.map((s) => s.value)).toEqual(["Rp147,86 jt", "Rp93,52 jt", "Rp39,78 jt"]);
    expect(b.stages.every((s) => s.unit === "Per year")).toBe(true);
    expect(b.teams.map((t) => [t.name, t.total])).toEqual([
      ["BD", "Rp19.049.190"],
      ["Marrakesh", "Rp20.739.240"],
    ]);
    expect(b.teams[0].items[2]).toEqual({ name: "Google AI Pro", amount: "3.708.000", note: "NotebookLM bundled" });
    expect(b.teams[0].items[3]).toEqual({ name: "GWI Plus (1 Month)", amount: "2.727.150" });
    expect(b.reduction).toEqual({ label: "Total cost reduction", value: "73,1%" });
    expect(b.saving).toEqual({ label: "Annual potential saving", value: "Rp108,07 jt" });
  });

  it("pairs labels with values when the deck puts labels in one row and values in the next", () => {
    // Live deck: separate text boxes, "Total cost reduction | Annual potential saving" then "73,1% | Rp108,07 jt".
    const b = block("investment");
    expect(b.stages.map((s) => s.label)).toEqual(["Initial Investment", "Previous Proposal", "Final Proposal"]);
    expect(b.reduction?.value).toBe("73,1%");
    expect(b.saving?.value).toBe("Rp108,07 jt");
  });

  it("ignores scratch notes parked outside the slide", () => {
    expect(JSON.stringify(deck)).not.toContain("Expected impact");
  });

  it("investment line items add up to the team totals in the deck", () => {
    for (const t of block("investment").teams) {
      const sum = t.items.reduce((a, i) => a + (parseRupiah(i.amount) ?? 0), 0);
      expect(sum).toBe(parseRupiah(t.total!));
    }
  });

  it("use cases", () => {
    const m = block("usecases", 0);
    expect(m.target).toEqual({ count: "312", label: "Target Videos Per Year for Nord & Smith" });
    expect(m.outputs.map((o) => o.count)).toEqual(["240", "12", "60"]);
    expect(m.outputs.reduce((a, o) => a + Number(o.count), 0)).toBe(312);
    expect(m.supporting).toHaveLength(5);
    const bd = block("usecases", 1);
    expect(bd.team).toBe("Business Development");
    expect(bd.cases).toHaveLength(5);
  });

  it("workflow pipelines", () => {
    const b = block("workflow");
    expect(b.pipelines.map((p) => p.team)).toEqual(["BD", "Marrakesh"]);
    expect(b.pipelines[1].steps).toEqual(["Brief", "Concept", "Assets", "Production", "Audio", "Human QC", "Delivery"]);
  });

  it("efficiency tiers and monitoring image", () => {
    const b = block("efficiency", 0);
    expect(b.tiers.map((t) => t.level)).toEqual(["LOW", "BALANCED", "POWERFUL"]);
    expect(block("efficiency", 1).image?.url).toBe("fixture:dashboard.jpg");
  });

  it("action plan", () => {
    const b = block("action_plan");
    expect(b.prompts).toHaveLength(9);
    expect(b.flow?.output).toBe("Reusable AI Skills");
    expect(b.training?.label).toBe("Training");
  });

  it("verdict: notes declare only `section`, every missing key falls back to visible text", () => {
    const b = block("verdict");
    expect(b.budget).toEqual({ value: "Rp37,06 jt", label: "Annual Budget" });
    expect(b.closing).toBe("Less Spending. Greater Capability.");
    expect(b.points).toHaveLength(4);
  });
});

describe("speaker-note overrides", () => {
  it("a notes key overrides visible text; unknown keys are ignored", () => {
    const copy = structuredClone(fixture) as unknown as SlidesPresentation;
    const verdict = copy.slides!.find((s) => s.objectId === "s18")!;
    const notesEl = verdict.slideProperties!.notesPage!.pageElements![0];
    const text = "section: verdict\nclosing: Edited in notes\nnonsense_key: whatever\ncard: Budget | Rp37,06 jt | per year";
    notesEl.shape!.text!.textElements = [{ textRun: { content: text } }];
    const b = parseDeck(copy).chapters.find((c) => c.section === "verdict")!.blocks[0] as BlockOf<"verdict">;
    expect(b.closing).toBe("Edited in notes");
    expect(b.cards).toEqual([{ label: "Budget", value: "Rp37,06 jt", note: "per year" }]);
  });

  it("a deck with no recognisable slides fails validation instead of rendering empty", () => {
    expect(() => parseDeck({ presentationId: "x", slides: [] })).toThrow();
  });
});

describe("Indonesian numbers", () => {
  it("parses to integers for calculations", () => {
    expect(parseRupiah("Rp147,86 jt")).toBe(147_860_000);
    expect(parseRupiah("Rp16.322.040")).toBe(16_322_040);
    expect(parseRupiah("4.488.840")).toBe(4_488_840);
    expect(parsePercent("74,9%")).toBe(74.9);
  });

  it("deck totals are internally consistent", () => {
    // The deck derives its figures from the exact team totals (Rp39.788.430), then shows
    // them rounded to 2 decimals in "jt", so compare at that precision.
    const b = block("investment");
    const [initial, , final] = b.stages.map((s) => parseRupiah(s.value)!);
    const exactFinal = b.teams.reduce((a, t) => a + parseRupiah(t.total!)!, 0);
    const jt = (n: number) => Math.floor(n / 10_000) / 100;
    expect(jt(exactFinal)).toBe(final / 1_000_000);
    expect(jt(initial - exactFinal)).toBe(parseRupiah(b.saving!.value)! / 1_000_000);
    expect(Math.round(((initial - exactFinal) / initial) * 1000) / 10).toBe(parsePercent(b.reduction!.value));
  });

  it("count-up formatter lands exactly on the raw string", () => {
    for (const raw of ["Rp147,86 jt", "Rp19.049.190", "73,1%", "312", "Rp39,78 jt"]) {
      const p = numericParts(raw)!;
      expect(formatLike(p, p.value)).toBe(raw);
    }
  });
});
