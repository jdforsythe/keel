import { validName } from "./validName.ts";

/** Letters NFKD leaves whole, by the ASCII a person writes for them (k.create Names). */
const FOLD: Readonly<Record<string, string>> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ł: "l", þ: "th", ð: "d" };

/**
 * The name E1352's fix names for `name`, or undefined when none is valid: marks dropped (`é` -> `e`), the letters `FOLD`
 * lists spelled out, lowercased, each run of other characters one `-`, none at either end.
 */
export function suggestName(name: string): string | undefined {
  const n = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[ßæœøđłþð]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return validName(n) ? n : undefined;
}
