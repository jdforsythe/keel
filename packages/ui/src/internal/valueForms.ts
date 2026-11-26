import type { Tokens } from "../types/Tokens.ts";
import { varName } from "./varName.ts";

const N = "-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)";
const LENGTH = `(?:0|${N}(?:px|rem|em|%|vw|vh|ch))`;
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const whole = (re: string): RegExp => new RegExp(`^${re}$`);
const IS_LENGTH = whole(LENGTH);
const BREAKPOINT = whole(`${N}(?:px|em|rem)`);
const MOTION = whole(`${N}(?:ms|s)`);
const FAMILY = /^[A-Za-z0-9 -]+$|^"[^"'\\\r\n]*"$|^'[^"'\\\r\n]*'$/;
const BORDER_STYLES = ["solid", "dashed", "dotted", "double"];

/** Whether `v` is one `<color>` or a `<ref>` to a color token the tokens hold (k.values Forms). */
const paint = (v: string, refs: ReadonlySet<string>): boolean => {
  if (COLOR.test(v)) return true;
  const m = /^var\((--k-color-[^()\s]+)\)$/.exec(v);
  return m?.[1] !== undefined && refs.has(m[1]);
};

/** One shadow: an optional `inset`, 2 to 4 `<length>`s, then an optional `<color>` or `<ref>`. */
const shadow = (words: readonly string[], refs: ReadonlySet<string>): boolean => {
  const w = words[0] === "inset" ? words.slice(1) : words;
  const last = w.at(-1);
  const lengths = last !== undefined && !IS_LENGTH.test(last) && paint(last, refs) ? w.slice(0, -1) : w;
  return lengths.length >= 2 && lengths.length <= 4 && lengths.every((x) => IS_LENGTH.test(x));
};

/** Whether `v` is in the form of `group` (k.values): positive forms only, so anything else is refused. */
function holds(group: string, v: string, refs: ReadonlySet<string>): boolean {
  const words = v.split(" ");
  // Words are separated by single spaces; a quoted font family holds what it likes but a quote or backslash.
  if (group !== "font" && words.some((w) => w === "")) return false;
  switch (group) {
    case "color":
      return COLOR.test(v);
    case "space":
      return v === "auto" || IS_LENGTH.test(v);
    case "size":
      return ["auto", "min-content", "max-content", "fit-content"].includes(v) || IS_LENGTH.test(v);
    case "radius":
    case "fontSize":
      return IS_LENGTH.test(v);
    case "font":
      return v.split(", ").every((f) => f.trim() !== "" && FAMILY.test(f));
    case "weight":
      return v === "normal" || v === "bold" || (/^[1-9]\d{0,3}$/.test(v) && Number(v) <= 1000);
    case "shadow": {
      if (v === "none") return true;
      const each = v.split(", ");
      return each.length <= 4 && each.every((s) => shadow(s.split(" "), refs));
    }
    case "border":
      return (
        v === "0" ||
        v === "none" ||
        (words.length === 3 &&
          IS_LENGTH.test(words[0] ?? "") &&
          BORDER_STYLES.includes(words[1] ?? "") &&
          paint(words[2] ?? "", refs))
      );
    case "breakpoint":
      return BREAKPOINT.test(v);
    case "motion":
      return MOTION.test(v);
    default:
      return false;
  }
}

/**
 * The paths of every token value not in its group's form (k.values): `[group, name]`, or `[group, name, scheme]` for
 * one value of a color pair. A `<ref>` names the custom property of a color token these tokens hold.
 */
export function valueForms(tokens: Tokens): string[][] {
  const refs = new Set(Object.keys(tokens.color ?? {}).map((n) => varName("color", n)));
  const out: string[][] = [];
  for (const [group, values] of Object.entries(tokens)) {
    if (group === "base" || group === "look" || group === "schemes") continue;
    if (typeof values !== "object" || values === null) continue;
    for (const [name, v] of Object.entries(values)) {
      if (typeof v === "string") {
        if (!holds(group, v, refs)) out.push([group, name]);
      } else if (group === "color" && typeof v === "object" && v !== null)
        for (const scheme of ["light", "dark"])
          if (!holds("color", String(Reflect.get(v, scheme)), refs)) out.push([group, name, scheme]);
    }
  }
  return out;
}
