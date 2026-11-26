import type { Scheme } from "../types/Scheme.ts";
import type { Tokens } from "../types/Tokens.ts";

const isScheme = (s: string): s is Scheme => s === "light" || s === "dark";

/**
 * The app's color schemes (k.schemes): `tokens.schemes` when given; else both when one of the app's own colors (a
 * name with no `.`) is a `{ light, dark }` pair, so a library's pairs never turn an app half dark; else `["light"]`.
 */
export function schemesOf(tokens: Tokens): readonly Scheme[] {
  if (tokens.schemes !== undefined) return tokens.schemes.filter(isScheme);
  const own = Object.entries(tokens.color ?? {}).some(([name, v]) => !name.includes(".") && typeof v !== "string");
  return own ? ["light", "dark"] : ["light"];
}
