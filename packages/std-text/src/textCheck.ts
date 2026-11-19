import { graphemes } from "./graphemes.ts";

// Unicode Cc, U+2028, U+2029, bidi embeddings and overrides (U+202A to U+202E), isolates (U+2066 to U+2069).
const BLANK = /^\p{White_Space}+$/u;
const REST = `\\x7f-\\x9f${String.fromCharCode(0x2028, 0x2029, 0x202a)}-${String.fromCharCode(0x202e, 0x2066)}-${String.fromCharCode(0x2069)}]`;
const LINE = new RegExp(`[\\0-\\x1f${REST}`);
// The same set without U+000A.
const PARA = new RegExp(`[\\0-\\t\\v-\\x1f${REST}`);

/**
 * The `check` of `line` (`newline` false) and `para` (`newline` true) (std.text): NFC, no forbidden character, a character outside `White_Space` unless empty,
 * `min` to `max` graphemes. Throws unless `min` and `max` are integers with `0 <= min <= max` and `1 <= max <= 10000`.
 */
export function textCheck(min: number, max: number, newline: boolean): (v: string) => boolean {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || min > max || max < 1 || max > 10000) {
    throw new RangeError(`text bounds must be integers with 0 <= min <= max and 1 <= max <= 10000, got ${min}..${max}`);
  }
  const forbidden = newline ? PARA : LINE;
  return (v) => {
    if (v.normalize("NFC") !== v || forbidden.test(v) || BLANK.test(v)) return false;
    const n = graphemes(v);
    return n >= min && n <= max;
  };
}
