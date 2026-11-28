import type { Format } from "./Format.ts";
import type { Schema } from "./Schema.ts";

/**
 * A format value written in source (k.formats Literals): `text` typed `Format<string, N>`, for the format type `format`
 * over `s.string()`. `text` is a string literal (a `string`-typed text is a type error); `keel check` parses it with the
 * format registered under `N` and reports E1108 when it does not. Outside `keel check` the call parses `text` and throws
 * a `TypeError` naming the format and the first issue's rule. No side effect: an unused import ships nothing.
 */
export function formatLiteral<const N extends string, const T extends string>(
  format: Schema<Format<string, N>>,
  text: string extends T ? never : T,
): Format<string, N> {
  const r = format.parse(text);
  if (r.ok) return r.value;
  const rule = r.error.data.issues[0]?.rule ?? "type";
  throw new TypeError(`formatLiteral: ${JSON.stringify(text)} is not a ${format.doc()} (${rule})`);
}
