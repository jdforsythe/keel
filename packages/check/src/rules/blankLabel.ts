import { type Expression, type JSXAttribute, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Base elements whose `label` names the landmark or control. */
const ELEMENTS: readonly string[] = ["Box", "Input", "TextArea", "Select", "Checkbox"];

/** `node` without enclosing parentheses, `as`, `satisfies` and `!`, which change no value. */
function unwrap(node: Expression): Expression {
  let n = node;
  while (
    n.type === "ParenthesizedExpression" ||
    n.type === "TSAsExpression" ||
    n.type === "TSSatisfiesExpression" ||
    n.type === "TSNonNullExpression"
  )
    n = n.expression;
  return n;
}

/** The text of a string literal or a template literal without substitutions (unwrapped), else null. */
function literalText(expr: Expression | null | undefined): string | null {
  if (expr === null || expr === undefined) return null;
  const node = unwrap(expr);
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : null;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? null;
  return null;
}

/**
 * True for a text with no visible character: none outside White_Space (`space`), Default_Ignorable_Code_Point (`DI`),
 * Cf, M and U+2800, as std.text's `line` reads it, and Cc.
 */
const blank = (text: string | null): boolean =>
  text !== null && !/[^\p{space}\p{DI}\p{Cf}\p{M}\p{Cc}\u2800]/u.test(text);

/** A JSX attribute string with its numeric character references decoded and each named one (`&copy;`) left out. */
const decode = (text: string): string =>
  text.replace(/&(?:#(x[\da-f]+|\d+)|[a-z][\da-z]*);/gi, (all, n: string | undefined) => {
    if (n === undefined) return "";
    const code = Number(n[0] === "x" || n[0] === "X" ? `0${n}` : n);
    return code > 0x10ffff ? all : String.fromCodePoint(code);
  });

/** The value of a `label` JSX attribute as a literal text, else null. */
function attributeText(a: JSXAttribute): string | null {
  const v = a.value;
  if (v === null || v === undefined) return null;
  if (v.type === "Literal") return typeof v.value === "string" ? decode(v.value) : null;
  if (v.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression") {
    return literalText(v.expression);
  }
  return null;
}

/** Calls `at` with the start of each blank `label` property of an object literal, its object-literal spreads read too. */
function objectLabels(node: Expression, at: (start: number) => void): void {
  const o = unwrap(node);
  if (o.type !== "ObjectExpression") return;
  for (const p of o.properties) {
    if (p.type === "SpreadElement") objectLabels(p.argument, at);
    else if (
      !p.computed &&
      p.kind === "init" &&
      (p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" && p.key.value) === "label" &&
      blank(literalText(p.value))
    )
      at(p.start);
  }
}

/**
 * E1802 (k.a11y): a blank literal `label` (no visible character, `blank`; a string, a template without substitutions, in a
 * JSX attribute, an object-literal spread into one, or the object passed to a call, through parentheses, `as`,
 * `satisfies` and `!`) on `Box`, `Input`, `TextArea`, `Select` or `Checkbox` from
 * `@keel/ui`, aliases and a namespace import followed. A computed `label` is unchecked. No fix: the name is the author's.
 */
export const blankLabel: RuleDef = {
  code: "E1802",
  message: (f) => {
    const name = str(f.data, "name");
    return `<${name}> label is blank; it must name the ${name === "Box" ? "landmark" : "control"}`;
  },
  explain: "A blank label names nothing; give the landmark or control a name.",
  see: "k.a11y",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const locals = new Map<string, string>();
    for (const name of ELEMENTS) for (const local of localNames(ast, name, "@keel/ui")) locals.set(local, name);
    const spaces = new Set<string>();
    for (const st of ast.body)
      if (st.type === "ImportDeclaration" && st.source.value === "@keel/ui")
        for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") spaces.add(sp.local.name);
    if (locals.size === 0 && spaces.size === 0) return [];
    const member = (o: string, p: string): string | undefined =>
      spaces.has(o) && ELEMENTS.includes(p) ? p : undefined;
    const out: Finding[] = [];
    const at = (name: string) => (start: number) => out.push(findingAt(file, start, { name }));
    new Visitor({
      JSXOpeningElement: (o) => {
        const n = o.name;
        const name =
          n.type === "JSXIdentifier"
            ? locals.get(n.name)
            : n.type === "JSXMemberExpression" && n.object.type === "JSXIdentifier"
              ? member(n.object.name, n.property.name)
              : undefined;
        if (name === undefined) return;
        for (const a of o.attributes) {
          if (a.type === "JSXSpreadAttribute") objectLabels(a.argument, at(name));
          if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== "label") continue;
          if (blank(attributeText(a))) at(name)(a.start);
        }
      },
      CallExpression: (n) => {
        const c = n.callee;
        const name =
          c.type === "Identifier"
            ? locals.get(c.name)
            : c.type === "MemberExpression" &&
                !c.computed &&
                c.object.type === "Identifier" &&
                c.property.type === "Identifier"
              ? member(c.object.name, c.property.name)
              : undefined;
        const arg = n.arguments[0];
        if (name === undefined || arg === undefined || arg.type === "SpreadElement") return;
        objectLabels(arg, at(name));
      },
    }).visit(ast);
    return out;
  },
};
