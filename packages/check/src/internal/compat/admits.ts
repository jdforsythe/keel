import { canonicalJson } from "../canonicalJson.ts";
import type { Refusal } from "./Refusal.ts";
import { isRecord } from "./isRecord.ts";
import { shapeOf } from "./shapeOf.ts";

const no = (path: readonly string[], why: Refusal["why"]): Refusal => ({ path, why });
const inside = (v: number, min: number | undefined, max: number | undefined): boolean =>
  (min === undefined || v >= min) && (max === undefined || v <= max);

/** Whether the JSON Schema `a` parses the one value `v` (a literal or enum member): `null` when it does. */
export function admits(a: unknown, v: unknown, path: readonly string[] = []): Refusal | null {
  const A = shapeOf(a);
  switch (A.kind) {
    case "any":
      return null;
    case "union": {
      const hits = A.members.map((m) => admits(m, v, path));
      return hits.some((r) => r === null) ? null : (hits[0] ?? no(path, "type"));
    }
    case "const":
      return canonicalJson(A.value) === canonicalJson(v) ? null : no(path, "value");
    case "enum":
      return A.values.includes(v) ? null : no(path, "value");
    case "string":
      if (typeof v !== "string") return no(path, "type");
      if (A.format !== undefined) return no(path, "format");
      return inside(v.length, A.min, A.max) ? null : no(path, "bounds");
    case "number":
      if (typeof v !== "number" || (A.int && !Number.isSafeInteger(v))) return no(path, "type");
      return inside(v, A.min, A.max) ? null : no(path, "bounds");
    case "boolean":
      return typeof v === "boolean" ? null : no(path, "type");
    case "null":
      return v === null ? null : no(path, "type");
    case "array":
      if (!Array.isArray(v)) return no(path, "type");
      for (const item of v) {
        const r = admits(A.items, item, [...path, "[]"]);
        if (r !== null) return r;
      }
      return null;
    case "object": {
      if (!isRecord(v)) return no(path, "type");
      for (const k of [...A.required].sort()) if (!Object.hasOwn(v, k)) return no([...path, k], "missing");
      for (const k of Object.keys(v).sort()) {
        const at = [...path, k];
        const r = Object.hasOwn(A.props, k) ? admits(A.props[k], v[k], at) : A.closed ? no(at, "extra") : null;
        if (r !== null) return r;
      }
      return null;
    }
    case "record":
      if (!isRecord(v)) return no(path, "type");
      for (const k of Object.keys(v).sort()) {
        const r = admits(A.value, v[k], [...path, k]);
        if (r !== null) return r;
      }
      return null;
    case "unknown":
      return no(path, "type");
  }
}
