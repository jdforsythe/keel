import type ts from "typescript";
import type { Edit } from "../types/Edit.ts";

/**
 * The edit removing member `p` of object literal `obj`: the member with the comma after it, or, for the last
 * member, with the comma before it; the whole text between the braces for an only member.
 */
export function dropMember(obj: ts.ObjectLiteralExpression, p: ts.ObjectLiteralElementLike): Edit {
  const props = obj.properties;
  const i = props.indexOf(p);
  const next = props[i + 1];
  const prev = props[i - 1];
  if (next !== undefined) return { start: p.getStart(), end: next.getStart(), text: "" };
  if (prev !== undefined) return { start: prev.end, end: p.end, text: "" };
  return { start: obj.getStart() + 1, end: obj.end - 1, text: " " };
}
