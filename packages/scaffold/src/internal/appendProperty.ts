import type MagicString from "magic-string";
import type { ObjectExpression } from "oxc-parser";
import { lineIndent } from "./lineIndent.ts";

/**
 * Append `text` (`key: value`) as the last property of an object literal, keeping its layout: inline objects
 * stay inline; multi-line objects get one line at the last property's indent. An empty object becomes
 * multi-line when `multiline` is set.
 */
export function appendProperty(
  ms: MagicString,
  src: string,
  obj: ObjectExpression,
  text: string,
  multiline = false,
): void {
  const last = obj.properties[obj.properties.length - 1];
  const first = obj.properties[0];
  if (last === undefined || first === undefined) {
    const ind = lineIndent(src, obj.start);
    ms.overwrite(obj.start, obj.end, multiline ? `{\n${ind}  ${text},\n${ind}}` : `{ ${text} }`);
    return;
  }
  const isMulti = src.slice(obj.start, first.start).includes("\n");
  const tail = src.slice(last.end, obj.end - 1);
  const comma = tail.indexOf(",");
  if (isMulti) {
    const ind = lineIndent(src, last.start);
    if (comma >= 0) ms.appendLeft(last.end + comma + 1, `\n${ind}${text},`);
    else ms.appendLeft(last.end, `,\n${ind}${text}`);
  } else if (comma >= 0) ms.appendLeft(last.end + comma + 1, ` ${text},`);
  else ms.appendLeft(last.end, `, ${text}`);
}
