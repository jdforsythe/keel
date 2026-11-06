import type { JSXAttributeName } from "oxc-parser";

/** Source name of a JSX attribute (`class`, `aria-label`, `xlink:href`). */
export function attrNameOf(n: JSXAttributeName): string {
  return n.type === "JSXIdentifier" ? n.name : `${n.namespace.name}:${n.name.name}`;
}
