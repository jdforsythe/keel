import type { Expression } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import type { Edit } from "../Edit.ts";
import type { Span } from "../Span.ts";
import { bindsTo } from "../bindsTo.ts";
import { componentFns } from "../componentFns.ts";
import { diag } from "../diag.ts";
import { propsNameOf } from "../propsNameOf.ts";
import { unifiedPatch } from "../unifiedPatch.ts";

/** Spans of the expressions a binding evaluates: JSX attribute values, spreads and child expressions. */
function sinks(a: Analysis): Span[] {
  const out: Span[] = [];
  for (const j of a.jsx) {
    if (j.type === "JSXElement")
      for (const at of j.openingElement.attributes) {
        if (at.type === "JSXSpreadAttribute") out.push(at.argument);
        else if (at.value?.type === "JSXExpressionContainer") out.push(at.value);
      }
    for (const c of j.children) if (c.type === "JSXExpressionContainer") out.push(c);
  }
  return out;
}

/**
 * The props `x` reads when it is a prop read and nothing else: member chains on `props` (any depth, `?.`, literal
 * keys), literals, and operators over them. Calls, other names and functions give null, so the fix never moves
 * work or a name into a binding.
 */
function keysOf(x: Expression, props: string): string[] | null {
  const all = (xs: readonly Expression[]): string[] | null => {
    const out: string[] = [];
    for (const y of xs) {
      const k = keysOf(y, props);
      if (k === null) return null;
      out.push(...k);
    }
    return out;
  };
  switch (x.type) {
    case "ParenthesizedExpression":
      return keysOf(x.expression, props);
    case "ChainExpression":
      return x.expression.type === "MemberExpression" ? keysOf(x.expression, props) : null;
    case "MemberExpression": {
      const p = x.property;
      const key = p.type === "Identifier" && !x.computed ? p.name : p.type === "Literal" ? p.value : null;
      if (typeof key !== "string" && (x.computed ? p.type !== "Literal" : true)) return null;
      if (x.object.type === "Identifier" && x.object.name === props) return typeof key === "string" ? [key] : null;
      return x.object.type === "Super" ? null : keysOf(x.object, props);
    }
    case "LogicalExpression":
      return all([x.left, x.right]);
    case "BinaryExpression":
      return x.left.type === "PrivateIdentifier" ? null : all([x.left, x.right]);
    case "ConditionalExpression":
      return all([x.test, x.consequent, x.alternate]);
    case "UnaryExpression":
      return x.operator === "delete" ? null : keysOf(x.argument, props);
    case "TemplateLiteral":
      return all(x.expressions);
    case "Literal":
      return [];
    default:
      return null;
  }
}

const simple = (e: Expression): boolean =>
  e.type === "MemberExpression" || e.type === "ChainExpression" || e.type === "Literal";

/** `stmt` with the whitespace after it, or its whole lines when it stands alone on them. */
function removal(src: string, stmt: Span): Edit {
  const lineStart = src.lastIndexOf("\n", stmt.start - 1) + 1;
  let end = stmt.end;
  while (src[end] === " " || src[end] === "\t") end++;
  const alone = src.slice(lineStart, stmt.start).trim() === "";
  // From the newline before it: a patch hunk edits whole lines, so the removal stays inside the lines it names.
  if (alone && lineStart > 0 && (src[end] === "\n" || end === src.length))
    return { start: lineStart - 1, end, text: "" };
  return { start: stmt.start, end, text: "" };
}

/**
 * E1405 (k.component): a `const` at a component's top level holding a prop read (`const label = props.label`)
 * whose value reaches an attribute, a text node or a child's props through a JSX expression, outside any function
 * there. That value is read once, so a kept `For` row or any later prop change shows the old one. One diagnostic
 * per such `const`; the fix reads the prop in each binding and drops the `const` when nothing else uses it. A
 * read used only in a handler, an effect or a function is not reported.
 */
export function ruleTopLevelPropRead(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  const containers = sinks(a);
  for (const f of componentFns(a)) {
    const props = propsNameOf(f);
    const body = f.node.body;
    if (props === undefined || body === null || body.type !== "BlockStatement") continue;
    const scope = { start: body.start, end: body.end };
    for (const st of body.body) {
      if (st.type !== "VariableDeclaration" || st.kind !== "const") continue;
      for (const d of st.declarations) {
        const init = d.init;
        if (d.id.type !== "Identifier" || init === null) continue;
        const key = keysOf(init, props)?.[0];
        if (key === undefined || !bindsTo(a, props, init.start, f)) continue;
        const local = d.id.name;
        const refs = (a.identsByName.get(local) ?? []).filter(
          (r) => r.start >= body.start && r.end <= body.end && bindsTo(a, local, r.start, scope),
        );
        const reached = refs.filter((r) =>
          containers.some(
            (c) =>
              c.start <= r.start &&
              r.end <= c.end &&
              !a.functions.some((g) => g.start >= c.start && g.end <= c.end && g.start <= r.start && r.end <= g.end),
          ),
        );
        if (reached.length === 0) continue;
        const raw = a.source.slice(init.start, init.end);
        const read = simple(init) ? raw : `(${raw})`;
        const edits: Edit[] = reached.map((r) => ({
          start: r.start,
          end: r.end,
          text: r.shorthand ? `${local}: ${read}` : read,
        }));
        if (reached.length === refs.length && st.declarations.length === 1) edits.push(removal(a.source, st));
        const name = (f.name ?? a.stem).slice(0, 24);
        const message = `${props.slice(0, 12)}.${key.slice(0, 20)} read once in ${name}; read it in the binding`;
        out.push(diag(a, "E1405", init.start, message, "k.component", unifiedPatch(a.path, a.source, edits)));
      }
    }
  }
  return out;
}
