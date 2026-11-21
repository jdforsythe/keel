import { type Expression, type Program, Visitor } from "oxc-parser";

const isIdentifier = (e: Expression, name: string): boolean => {
  const x = unwrap(e);
  return x.type === "Identifier" && x.name === name;
};
function unwrap(e: Expression): Expression {
  let x = e;
  while (x.type === "ParenthesizedExpression") x = x.expression;
  return x;
}

/**
 * The module specifiers a program imports or re-exports, with spans: `import`, `export { } from`, `export * from`, and
 * `import('x')` expressions and `require('x')` calls whose argument is a string literal or a template literal without
 * substitutions (or a `+` of those, or a `const` bound to one), and `import x = require('x')`; `require` may be parenthesized, `module.require`, `createRequire(...)`, or bound to a name. Type-only declarations (`import type`, `export type ... from`,
 * `import type x = require('x')`) are erased at compile time and are not sources.
 */
export function sourcesOf(program: Program): { readonly value: string; readonly start: number }[] {
  const out: { value: string; start: number }[] = [];
  for (const st of program.body) {
    if (st.type === "ImportDeclaration" && st.importKind !== "type") out.push(st.source);
    else if (st.type === "ExportAllDeclaration" && st.exportKind !== "type") out.push(st.source);
    else if (st.type === "ExportNamedDeclaration" && st.source !== null && st.exportKind !== "type")
      out.push(st.source);
  }
  const consts = new Map<string, string>();
  const requireNames = new Set<string>(["require"]);
  /** The string an expression is when it is a literal, a template without substitutions, a `+` of those, or a `const` bound to one. */
  const text = (e: Expression): string | undefined => {
    const x = unwrap(e);
    if (x.type === "Literal") return typeof x.value === "string" ? x.value : undefined;
    if (x.type === "TemplateLiteral" && x.expressions.length === 0) {
      const cooked = x.quasis[0]?.value.cooked;
      return typeof cooked === "string" ? cooked : undefined;
    }
    if (x.type === "BinaryExpression" && x.operator === "+") {
      const l = text(x.left);
      const r = text(x.right);
      return l !== undefined && r !== undefined ? l + r : undefined;
    }
    if (x.type === "Identifier") return consts.get(x.name);
    return undefined;
  };
  /** Whether `e` is `require`, `module.require`, `createRequire(...)` or a name bound to one of them. */
  const isRequire = (e: Expression): boolean => {
    const x = unwrap(e);
    if (x.type === "Identifier") return requireNames.has(x.name);
    if (x.type === "MemberExpression")
      return (
        !x.computed &&
        x.property.type === "Identifier" &&
        x.property.name === "require" &&
        isIdentifier(x.object, "module")
      );
    if (x.type === "CallExpression") {
      const c = unwrap(x.callee);
      return c.type === "Identifier" && c.name === "createRequire";
    }
    return false;
  };
  const literal = (s: Expression): void => {
    const value = text(s);
    if (value !== undefined) out.push({ value, start: s.start });
  };
  new Visitor({
    VariableDeclarator: (n) => {
      if (n.id.type !== "Identifier" || n.init === null || n.init === undefined) return;
      const v = text(n.init);
      if (v !== undefined) consts.set(n.id.name, v);
      else if (isRequire(n.init)) requireNames.add(n.id.name);
    },
    ImportExpression: (n) => literal(n.source),
    CallExpression: (n) => {
      const arg = n.arguments[0];
      if (isRequire(n.callee) && arg !== undefined && arg.type !== "SpreadElement") literal(arg);
    },
    TSImportEqualsDeclaration: (n) => {
      const ref = n.moduleReference;
      if (n.importKind !== "type" && ref.type === "TSExternalModuleReference") literal(ref.expression);
    },
  }).visit(program);
  return out;
}
