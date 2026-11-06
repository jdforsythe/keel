import type { JSXElementName, JSXMemberExpressionObject } from "oxc-parser";

function member(n: JSXMemberExpressionObject): string {
  return n.type === "JSXIdentifier" ? n.name : `${member(n.object)}.${n.property.name}`;
}

/** Source name of a JSX element (`div`, `svg:rect`, `Foo`, `ui.Button`). */
export function tagNameOf(n: JSXElementName): string {
  if (n.type === "JSXIdentifier") return n.name;
  if (n.type === "JSXNamespacedName") return `${n.namespace.name}:${n.name.name}`;
  return member(n);
}
