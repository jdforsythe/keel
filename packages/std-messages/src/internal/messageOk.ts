import type { ParamKind } from "./ParamKind.ts";
import { templateOk } from "./templateOk.ts";

const FORMS = ["plural", "zero", "one", "two", "few", "many", "other"];

const fields = (v: unknown): Map<string, unknown> | undefined =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? new Map(Object.entries(v)) : undefined;

/**
 * An object message for a key with `params` (std.messages): `{ text }`, `{ plural: p, other, ...forms }` over a number
 * param, or `{ select: p, cases }` with one case per value of an enum param; every template names declared params only.
 */
export function messageOk(v: unknown, params: ReadonlyMap<string, ParamKind>): boolean {
  const m = fields(v);
  if (m === undefined) return false;
  const ok = (x: unknown): boolean => templateOk(x, [...params.keys()]);
  if (m.has("text")) return m.size === 1 && ok(m.get("text"));
  const p = m.has("plural") ? m.get("plural") : m.get("select");
  const kind = typeof p === "string" ? params.get(p) : undefined;
  if (m.has("plural"))
    return (
      kind === "number" && m.has("other") && [...m].every(([k, x]) => FORMS.includes(k) && (k === "plural" || ok(x)))
    );
  const cases = fields(m.get("cases"));
  return m.size === 2 && typeof kind === "object" && cases?.size === kind.length && kind.every((c) => ok(cases.get(c)));
}
