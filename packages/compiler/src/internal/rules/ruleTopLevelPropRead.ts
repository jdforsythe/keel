import { type BlockStatement, type Expression, type Program, Visitor } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import type { Edit } from "../Edit.ts";
import type { Span } from "../Span.ts";
import { attrNameOf } from "../attrNameOf.ts";
import { bindsTo } from "../bindsTo.ts";
import { componentFns } from "../componentFns.ts";
import { diag } from "../diag.ts";
import { intrinsicOf } from "../intrinsicOf.ts";
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

/** A read of key `key` off the root name `root` (`props` or a row's item), at the root identifier `at`. */
type Read = { root: string; key: string; at: number };

/**
 * The reads `x` makes when it is a read of `roots` and nothing else: member chains on a root (any depth, `?.`,
 * literal keys), literals, and operators over them. Calls, other names and functions give null, so the fix never
 * moves work or a name into a binding.
 */
function keysOf(x: Expression, roots: ReadonlyMap<string, Span>): Read[] | null {
  const all = (xs: readonly Expression[]): Read[] | null => {
    const out: Read[] = [];
    for (const y of xs) {
      const k = keysOf(y, roots);
      if (k === null) return null;
      out.push(...k);
    }
    return out;
  };
  switch (x.type) {
    case "ParenthesizedExpression":
      return keysOf(x.expression, roots);
    case "ChainExpression":
      return x.expression.type === "MemberExpression" ? keysOf(x.expression, roots) : null;
    case "MemberExpression": {
      const p = x.property;
      const key = p.type === "Identifier" && !x.computed ? p.name : p.type === "Literal" ? p.value : null;
      if (typeof key !== "string" && (x.computed ? p.type !== "Literal" : true)) return null;
      if (x.object.type === "Identifier" && roots.has(x.object.name))
        return typeof key === "string" ? [{ root: x.object.name, key, at: x.object.start }] : null;
      return x.object.type === "Super" ? null : keysOf(x.object, roots);
    }
    case "LogicalExpression":
      return all([x.left, x.right]);
    case "BinaryExpression":
      return x.left.type === "PrivateIdentifier" ? null : all([x.left, x.right]);
    case "ConditionalExpression":
      return all([x.test, x.consequent, x.alternate]);
    case "UnaryExpression":
      return x.operator === "delete" ? null : keysOf(x.argument, roots);
    case "TemplateLiteral":
      return all(x.expressions);
    case "Literal":
      return [];
    default:
      return null;
  }
}

/** `e` without parentheses and type-only wrappers. */
function bare(e: Expression): Expression {
  if (e.type === "ParenthesizedExpression") return bare(e.expression);
  if (
    e.type === "TSAsExpression" ||
    e.type === "TSSatisfiesExpression" ||
    e.type === "TSNonNullExpression" ||
    e.type === "TSTypeAssertion"
  )
    return bare(e.expression);
  return e;
}

/**
 * The starts of identifiers in `program` that are called (a callee or a template tag), and of those that are the
 * object of a member access: inlining an initializer there can change `this` or how far `?.` short-circuits.
 */
function positions(program: Program): { called: Set<number>; object: Set<number> } {
  const called = new Set<number>();
  const object = new Set<number>();
  const at = (set: Set<number>, e: Expression): void => {
    const b = bare(e);
    if (b.type === "Identifier") set.add(b.start);
  };
  new Visitor({
    CallExpression: (n) => {
      if (n.callee.type !== "Super") at(called, n.callee);
    },
    TaggedTemplateExpression: (n) => at(called, n.tag),
    MemberExpression: (n) => {
      if (n.object.type !== "Super") at(object, n.object);
    },
  }).visit(program);
  return { called, object };
}

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

/** A function body to scan: its top-level `const`s, the names they may read (each with its declaring scope), and the component it is in. */
type Body = { body: BlockStatement; roots: Map<string, Span>; name: string };

/** The bodies of components with a props parameter, and of the row callbacks of keyed `For`s. */
function bodies(a: Analysis): Body[] {
  const out: Body[] = [];
  const comps = componentFns(a);
  for (const f of comps) {
    const props = propsNameOf(f);
    const body = f.node.body;
    if (props !== undefined && body !== null && body.type === "BlockStatement")
      out.push({ body, roots: new Map([[props, f]]), name: f.name ?? a.stem });
  }
  for (const j of a.jsx) {
    if (j.type !== "JSXElement" || intrinsicOf(a, j) !== "For") continue;
    const keyed = j.openingElement.attributes.some((at) => at.type === "JSXAttribute" && attrNameOf(at.name) === "key");
    if (!keyed) continue;
    const comp = comps.filter((f) => f.start <= j.start && j.end <= f.end).at(-1);
    const props = propsNameOf(comp);
    for (const c of j.children) {
      if (c.type !== "JSXExpressionContainer") continue;
      const fn = c.expression;
      if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression") continue;
      const item = fn.params[0];
      if (fn.body?.type !== "BlockStatement" || item?.type !== "Identifier") continue;
      const roots = new Map<string, Span>([[item.name, fn]]);
      if (comp !== undefined && props !== undefined && props !== item.name) roots.set(props, comp);
      out.push({ body: fn.body, roots, name: comp?.name ?? a.stem });
    }
  }
  return out;
}

/**
 * E1405 (k.component): a `const` at a component's top level, or at the top level of a keyed `For` row callback,
 * holding a read of props or of the row's item (`const label = props.label`, `const label = t.label`) whose value
 * reaches an attribute, a text node or a child's props through a JSX expression, outside any function there. That
 * value is read once, so a kept `For` row or any later prop change shows the old one. One diagnostic per such
 * `const`; the fix reads it in each binding and drops the `const` when nothing else uses it, parenthesizing what is
 * not a plain member access where it is the object of another. A `const` that is called has no fix, since the call
 * would take a `this`. A read used only in a handler, an effect or a function is not reported.
 */
export function ruleTopLevelPropRead(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  const containers = sinks(a);
  let uses: { called: Set<number>; object: Set<number> } | undefined;
  for (const { body, roots, name } of bodies(a)) {
    const scope = { start: body.start, end: body.end };
    for (const st of body.body) {
      if (st.type !== "VariableDeclaration" || st.kind !== "const") continue;
      for (const d of st.declarations) {
        const init = d.init;
        if (d.id.type !== "Identifier" || init === null) continue;
        const reads = keysOf(init, roots);
        const first = reads?.[0];
        if (reads === null || first === undefined) continue;
        if (!reads.every((r) => bindsTo(a, r.root, r.at, roots.get(r.root) ?? scope))) continue;
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
        uses ??= positions(a.program);
        const at = uses;
        const raw = a.source.slice(init.start, init.end);
        const plain = init.type === "MemberExpression" || init.type === "Literal";
        const read = (r: Span): string =>
          plain || (init.type === "ChainExpression" && !at.object.has(r.start)) ? raw : `(${raw})`;
        const edits: Edit[] = reached.map((r) => ({
          start: r.start,
          end: r.end,
          text: r.shorthand ? `${local}: ${read(r)}` : read(r),
        }));
        if (reached.length === refs.length && st.declarations.length === 1) edits.push(removal(a.source, st));
        const fix = reached.some((r) => at.called.has(r.start)) ? undefined : unifiedPatch(a.path, a.source, edits);
        const message = `${first.root.slice(0, 12)}.${first.key.slice(0, 20)} read once in ${name.slice(0, 24)}; read it in the binding`;
        out.push(diag(a, "E1405", init.start, message, "k.component", fix));
      }
    }
  }
  return out;
}
