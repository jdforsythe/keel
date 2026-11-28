import { Outside } from "./Outside.ts";

/** An SMT numeral for a finite JavaScript number: `(- 3)`, `1.5`. */
export function num(n: number): string {
  const text = String(Math.abs(n));
  if (/e/i.test(text) || !Number.isFinite(n)) throw new Outside(`number ${n}`, undefined);
  return n < 0 ? `(- ${text})` : text;
}
