import type { Combo } from "./Combo.ts";

const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** A value of a combination's group `group` named `name`, a pair's value at `scheme` when the tokens are as written. */
export function valueIn(c: Combo, group: "color" | "overlay", name: string): string | undefined {
  const g = isRec(c.tokens) ? c.tokens[group] : undefined;
  const v = isRec(g) ? g[name] : undefined;
  const raw = group === "overlay" && isRec(v) ? v.value : v;
  const out = isRec(raw) ? raw[c.scheme] : raw;
  return typeof out === "string" ? out : undefined;
}
