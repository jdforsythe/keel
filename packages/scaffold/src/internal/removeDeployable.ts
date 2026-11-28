import type { ObjectExpression } from "oxc-parser";
import { keyName } from "./keyName.ts";
import { propertyLayout } from "./propertyLayout.ts";

/** Remove deployable `name` from the `topology({...})` object with its separator: the inverse of `addDeployable`. */
export function removeDeployable(src: string, obj: ObjectExpression, name: string): string {
  const props = obj.properties;
  const i = props.findIndex((p) => keyName(p) === name);
  const prop = props[i];
  if (prop === undefined) return src;
  const next = props[i + 1];
  const prev = props[i - 1];
  const cut = (from: number, to: number): string => `${src.slice(0, from)}${src.slice(to)}`;
  if (next !== undefined) return cut(prop.start, next.start);
  if (prev === undefined) return cut(prop.start, prop.end);
  const { multiline, trailing } = propertyLayout(src, obj);
  if (multiline && trailing !== null) {
    const comma = /^\s*,/.exec(src.slice(prev.end));
    return cut(prev.end + (comma?.[0].length ?? 0), trailing);
  }
  return cut(prev.end, prop.end);
}
