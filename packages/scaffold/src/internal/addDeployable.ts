import type { ObjectExpression } from "oxc-parser";
import { keyName } from "./keyName.ts";
import { propertyLayout } from "./propertyLayout.ts";

/**
 * Add property `text` (deployable `name`) to the `topology({...})` object before the first deployable whose name
 * sorts after it, else at the end, in the object's layout (one line, or one property per line with its indent and
 * trailing comma), so `removeDeployable` restores the exact bytes.
 */
export function addDeployable(src: string, obj: ObjectExpression, name: string, text: string): string {
  const { multiline, indent, trailing } = propertyLayout(src, obj);
  const before = obj.properties.find((p) => (keyName(p) ?? "") > name);
  const last = obj.properties[obj.properties.length - 1];
  const at = (i: number, t: string): string => `${src.slice(0, i)}${t}${src.slice(i)}`;
  if (before !== undefined) return at(before.start, multiline ? `${text},\n${indent}` : `${text}, `);
  if (last === undefined) return at(obj.end - 1, ` ${text} `);
  if (multiline && trailing !== null) return at(trailing, `\n${indent}${text},`);
  return at(last.end, multiline ? `,\n${indent}${text}` : `, ${text}`);
}
