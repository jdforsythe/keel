import { type Expression, type Program, Visitor } from "oxc-parser";
import type { HostUse } from "./HostUse.ts";
import { localNames } from "./modules/localNames.ts";

type Props = Map<string, { readonly start: number; readonly value: Expression | null }>;

/** Reads an object literal's named props into `props`; true when some prop may come from elsewhere. */
function objectProps(node: Expression, props: Props): boolean {
  let o = node;
  while (o.type === "ParenthesizedExpression" || o.type === "TSAsExpression" || o.type === "TSSatisfiesExpression")
    o = o.expression;
  if (o.type !== "ObjectExpression") return true;
  let spread = false;
  for (const p of o.properties) {
    if (p.type === "SpreadElement") {
      spread = objectProps(p.argument, props) || spread;
      continue;
    }
    const key = p.computed
      ? undefined
      : p.key.type === "Identifier"
        ? p.key.name
        : p.key.type === "Literal"
          ? p.key.value
          : undefined;
    if (typeof key !== "string" || p.kind !== "init") spread = true;
    else props.set(key, { start: p.start, value: p.value });
  }
  return spread;
}

/**
 * The uses of `Host` from `@keel/ui` in `ast` (k.host-element): JSX elements and calls, by a named import (aliases
 * followed) or a namespace import's member, in source order.
 */
export function hostUses(ast: Program): HostUse[] {
  const locals = localNames(ast, "Host", "@keel/ui");
  const spaces = new Set<string>();
  for (const st of ast.body)
    if (st.type === "ImportDeclaration" && st.source.value === "@keel/ui")
      for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") spaces.add(sp.local.name);
  if (locals.size === 0 && spaces.size === 0) return [];
  const out: HostUse[] = [];
  new Visitor({
    JSXOpeningElement: (o) => {
      const n = o.name;
      const is =
        n.type === "JSXIdentifier"
          ? locals.has(n.name)
          : n.type === "JSXMemberExpression" &&
            n.object.type === "JSXIdentifier" &&
            spaces.has(n.object.name) &&
            n.property.name === "Host";
      if (!is) return;
      const props: Props = new Map();
      let spread = false;
      for (const a of o.attributes) {
        if (a.type === "JSXSpreadAttribute") {
          spread = true;
          continue;
        }
        if (a.name.type !== "JSXIdentifier") continue;
        const v = a.value;
        const value =
          v !== null && v.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression"
            ? v.expression
            : null;
        props.set(a.name.name, { start: a.start, value });
      }
      out.push({ start: o.name.start, spread, props });
    },
    CallExpression: (n) => {
      const c = n.callee;
      const is =
        c.type === "Identifier"
          ? locals.has(c.name)
          : c.type === "MemberExpression" &&
            !c.computed &&
            c.object.type === "Identifier" &&
            spaces.has(c.object.name) &&
            c.property.type === "Identifier" &&
            c.property.name === "Host";
      if (!is) return;
      const props: Props = new Map();
      const arg = n.arguments[0];
      const spread = arg === undefined || arg.type === "SpreadElement" ? true : objectProps(arg, props);
      out.push({ start: n.start, spread, props });
    },
  }).visit(ast);
  return out;
}
