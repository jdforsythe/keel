import type { ObjectExpression } from "oxc-parser";

/**
 * How an object literal lays out its properties: `multiline` when the first one starts on its own line (then
 * `indent` is the whitespace before it), and whether the last one carries a trailing comma (`trailing`, its offset).
 */
export function propertyLayout(
  src: string,
  obj: ObjectExpression,
): { multiline: boolean; indent: string; trailing: number | null } {
  const first = obj.properties[0];
  const last = obj.properties[obj.properties.length - 1];
  if (first === undefined || last === undefined) return { multiline: false, indent: "", trailing: null };
  const lead = src.slice(obj.start + 1, first.start);
  const multiline = lead.includes("\n");
  const indent = multiline ? lead.slice(lead.lastIndexOf("\n") + 1) : "";
  const tail = /^\s*,/.exec(src.slice(last.end, obj.end - 1));
  return { multiline, indent, trailing: tail === null ? null : last.end + tail[0].length };
}
