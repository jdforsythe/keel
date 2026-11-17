import { segmenter } from "./segmenter.ts";

// Unicode Cc, U+2028, U+2029 and Bidi_Control; para allows U+000A.
const LINE = /\p{Cc}|[\u2028\u2029\p{Bidi_Control}]/u;
const PARA = /(?!\n)\p{Cc}|[\u2028\u2029\p{Bidi_Control}]/u;
// A character a reader sees: outside White_Space and Default_Ignorable_Code_Point.
const VISIBLE = /[^\p{White_Space}\p{Default_Ignorable_Code_Point}]/u;

/**
 * The `check` of `line` (`newline` false) and `para` (`newline` true) (std.text): NFC, no forbidden character, a visible character unless empty,
 * `min` to `max` graphemes. Throws unless `min` and `max` are integers with `0 <= min <= max` and `1 <= max <= 10000`.
 */
export function textCheck(min: number, max: number, newline: boolean): (v: string) => boolean {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || min > max || max < 1 || max > 10000) {
    throw new RangeError(`text bounds must be integers with 0 <= min <= max and 1 <= max <= 10000, got ${min}..${max}`);
  }
  const forbidden = newline ? PARA : LINE;
  return (v) => {
    if (v.normalize("NFC") !== v || forbidden.test(v) || (v !== "" && !VISIBLE.test(v))) return false;
    // Counting stops at max + 1: a longer value is rejected without segmenting the rest.
    let n = 0;
    for (const _ of segmenter.segment(v)) if (++n > max) return false;
    return n >= min;
  };
}
