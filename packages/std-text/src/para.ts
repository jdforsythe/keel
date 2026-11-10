import type { Format, Schema } from "@keel/schema";
import { textFormat } from "./textFormat.ts";

/** `line` that also allows U+000A (std.text), named `para(<min>..<max>)`. */
export function para<const Max extends number>(opts: { readonly max: Max }): Schema<Format<string, `para(1..${Max})`>>;
export function para<const Min extends number, const Max extends number>(opts: {
  readonly min: Min;
  readonly max: Max;
}): Schema<Format<string, `para(${Min}..${Max})`>>;
export function para(opts: { readonly min?: number; readonly max: number }): Schema<Format<string, string>> {
  const min = opts.min ?? 1;
  return textFormat(`para(${min}..${opts.max})`, min, opts.max, true);
}
