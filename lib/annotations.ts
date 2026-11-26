/**
 * Short descriptions for tool line items, shown under the name when the deck
 * row has no note of its own. Supplied by Jan (2026-11-26), not from the deck.
 * A note written in the deck always wins.
 */
const ITEM_NOTES: [RegExp, string][] = [
  [/^higgsfield/i, "Video AI Generated"],
  [/^elevenlabs/i, "Voice Over"],
];

export function itemNote(name: string): string | undefined {
  return ITEM_NOTES.find(([re]) => re.test(name.trim()))?.[1];
}
