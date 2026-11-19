import { segmenter } from "./segmenter.ts";

/** The number of extended grapheme clusters (UAX #29) in `s`, what a reader counts as characters (std.text). */
export function graphemes(s: string): number {
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
}
