import type { Format, Schema } from "@keel/schema";
import { textFormat } from "./textFormat.ts";

/**
 * Text a person writes on one line (std.text): NFC, no control character, U+2028, U+2029 or `Bidi_Control` character, a visible character, and `min`
 * (default 1) to `max` graphemes. Named `line(<min>..<max>)`. Throws unless `0 <= min <= max` and `1 <= max <= 10000`
 * are integers.
 */
export function line<const Max extends number>(opts: { readonly max: Max }): Schema<Format<string, `line(1..${Max})`>>;
export function line<const Min extends number, const Max extends number>(opts: {
  readonly min: Min;
  readonly max: Max;
}): Schema<Format<string, `line(${Min}..${Max})`>>;
export function line(opts: { readonly min?: number; readonly max: number }): Schema<Format<string, string>> {
  const min = opts.min ?? 1;
  return textFormat(`line(${min}..${opts.max})`, min, opts.max, false);
}
