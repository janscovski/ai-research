/**
 * Indonesian number helpers.
 *
 * Display rule: the raw string from the deck is the source of truth and is
 * rendered as-is ("Rp147,86 jt", "Rp16.322.040", "74,9%"). These helpers only
 * exist for calculations (bar widths, sanity checks) and for the count-up
 * animation, which always lands on the exact raw string.
 *
 * Indonesian format: "." = thousands separator, "," = decimal separator.
 */

const SCALE: Record<string, number> = {
  rb: 1e3,
  ribu: 1e3,
  jt: 1e6,
  juta: 1e6,
  m: 1e9,
  miliar: 1e9,
  milyar: 1e9,
  t: 1e12,
  triliun: 1e12,
};

const NUMBER_RE = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?/;

/** "147,86" -> 147.86, "16.322.040" -> 16322040. Returns null when no number. */
export function parseIdDecimal(raw: string): number | null {
  const m = raw.match(NUMBER_RE);
  if (!m) return null;
  const int = m[1].replace(/\./g, "");
  const dec = m[2] ?? "";
  return Number(dec ? `${int}.${dec}` : int);
}

/**
 * Parse a Rupiah display string into integer Rupiah.
 * "Rp147,86 jt" -> 147_860_000, "Rp16.322.040" -> 16_322_040, "4.488.840" -> 4_488_840.
 */
export function parseRupiah(raw: string): number | null {
  const value = parseIdDecimal(raw);
  if (value === null) return null;
  const unit = raw
    .toLowerCase()
    .replace(/rp/g, "")
    .replace(/[\d.,\s]/g, "")
    .trim();
  const scale = unit ? SCALE[unit] ?? 1 : 1;
  return Math.round(value * scale);
}

/** "74,9%" -> 74.9 */
export function parsePercent(raw: string): number | null {
  if (!raw.includes("%")) return null;
  return parseIdDecimal(raw);
}

export interface NumericParts {
  prefix: string;
  value: number;
  decimals: number;
  grouped: boolean;
  suffix: string;
}

/** Split "Rp147,86 jt" into { prefix: "Rp", value: 147.86, decimals: 2, suffix: " jt" }. */
export function numericParts(raw: string): NumericParts | null {
  const m = raw.match(NUMBER_RE);
  if (!m || m.index === undefined) return null;
  const value = parseIdDecimal(m[0]);
  if (value === null) return null;
  return {
    prefix: raw.slice(0, m.index),
    value,
    decimals: m[2]?.length ?? 0,
    grouped: m[1].includes("."),
    suffix: raw.slice(m.index + m[0].length),
  };
}

/** Format a number using the same shape as the parts it came from (Indonesian separators). */
export function formatLike(parts: NumericParts, n: number): string {
  const fixed = n.toFixed(parts.decimals);
  const [int, dec] = fixed.split(".");
  const intOut = parts.grouped || Number(int) >= 1000 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : int;
  return `${parts.prefix}${intOut}${dec ? `,${dec}` : ""}${parts.suffix}`;
}

export const MONEY_RE = /^(?:Rp\s?)?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s?(?:rb|ribu|jt|juta|m|miliar|t|triliun)?$/i;
export const RUPIAH_RE = /^Rp\s?\d/i;
export const PERCENT_RE = /^\d+(?:,\d+)?\s?%$/;
