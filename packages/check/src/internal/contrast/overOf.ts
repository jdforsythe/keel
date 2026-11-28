import type { Combo } from "./Combo.ts";

const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** An overlay's `over` list in a combination, or undefined when `name` is no overlay. */
export const overOf = (c: Combo, name: string): readonly string[] | undefined => {
  const g = isRec(c.tokens) ? c.tokens.overlay : undefined;
  const v = isRec(g) ? g[name] : undefined;
  const over = isRec(v) ? v.over : undefined;
  return Array.isArray(over) ? over.filter((x): x is string => typeof x === "string") : undefined;
};
