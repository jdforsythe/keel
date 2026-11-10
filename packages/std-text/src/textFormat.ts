import { type Format, type Schema, s } from "@keel/schema";
import { graphemes } from "./graphemes.ts";
import { segmenter } from "./segmenter.ts";
import { textCheck } from "./textCheck.ts";

const BLANK = /^\p{White_Space}+$/u;

/**
 * The format type behind `line` and `para` (std.text): `s.string()` narrowed by `textCheck`, named `name`. Its generator
 * keeps the first `max` graphemes of a generated string (`~` becomes a line break in `para`), padded with `a` to `min`.
 */
export function textFormat<const N extends string>(
  name: N,
  min: number,
  max: number,
  newline: boolean,
): Schema<Format<string, N>> {
  const map = (v: string): string => {
    const text = (newline ? v.replaceAll("~", "\n") : v).normalize("NFC");
    const parts = Array.from(segmenter.segment(text), (x) => x.segment).slice(0, max);
    const last = parts.length - 1;
    if (last >= 0 && BLANK.test(parts.join(""))) parts[last] = "a";
    const head = parts.join("");
    return head + "a".repeat(Math.max(0, min - graphemes(head)));
  };
  return s.format(name, s.string(), { check: textCheck(min, max, newline), gen: { from: s.string(), map } });
}
