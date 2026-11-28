import type { ObjectExpression } from "oxc-parser";
import type { SourceEdit } from "./SourceEdit.ts";

/** The edit that adds `text` (a property) to the end of `obj`'s properties. */
export function appendProperty(obj: ObjectExpression, text: string): SourceEdit {
  const tail = obj.properties.at(-1);
  const at = tail === undefined ? obj.start + 1 : tail.end;
  return { start: at, end: at, text: tail === undefined ? ` ${text} ` : `, ${text}` };
}
