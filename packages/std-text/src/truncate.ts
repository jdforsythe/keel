import { segmenter } from "./segmenter.ts";

/**
 * `s` when it has at most `max` graphemes; otherwise its first `max - 1` graphemes with trailing white space removed,
 * then `…` (std.text). Throws unless `max` is an integer of at least 1.
 */
export function truncate(s: string, max: number): string {
  if (!Number.isInteger(max) || max < 1)
    throw new RangeError(`truncate: max must be an integer of at least 1, got ${max}`);
  // Segmenting stops at max + 1 graphemes: the rest of a longer string is never read.
  const parts: string[] = [];
  for (const x of segmenter.segment(s)) {
    if (parts.length === max)
      return `${parts
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`;
    parts.push(x.segment);
  }
  return s;
}
