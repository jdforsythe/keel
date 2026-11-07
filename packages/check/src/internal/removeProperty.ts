import type { ObjectExpression, ObjectProperty } from "oxc-parser";
import type { Edit } from "../types/Edit.ts";

/** The edit that deletes property `p` of `obj` together with one adjoining comma; `null` when `p` is not in `obj`. */
export function removeProperty(obj: ObjectExpression, p: ObjectProperty): Edit | null {
  const at = obj.properties.indexOf(p);
  if (at < 0) return null;
  const next = obj.properties[at + 1];
  const prev = obj.properties[at - 1];
  if (next !== undefined) return { start: p.start, end: next.start, text: "" };
  if (prev !== undefined) return { start: prev.end, end: p.end, text: "" };
  return { start: p.start, end: p.end, text: "" };
}
