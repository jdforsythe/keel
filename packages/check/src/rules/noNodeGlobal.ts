import { globalRefs, unwrapExpression } from "@keel/compiler/internal";
import { type Expression, type Program, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isBrowserFile } from "../internal/isBrowserFile.ts";
import { isNodeBuiltin } from "../internal/isNodeBuiltin.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Node-only globals a browser file must not read. */
const NODE_ONLY: ReadonlySet<string> = new Set(["process", "Buffer", "global", "setImmediate", "clearImmediate"]);
/** Names no ES module has, on the server or in the browser; the two with a fix map to `import.meta`. */
const NOT_IN_ESM: ReadonlyMap<string, string> = new Map([
  ["require", ""],
  ["__dirname", "import.meta.dirname"],
  ["__filename", "import.meta.filename"],
]);

type Span = { readonly name: string; readonly start: number; readonly end: number };

/** The name `e` tests as `typeof name !== 'undefined'` (or `!=`, either side), else null. */
function definedTest(e: Expression): string | null {
  const x = unwrapExpression(e);
  if (x.type === "LogicalExpression" && x.operator === "&&") return definedTest(x.left) ?? definedTest(x.right);
  if (x.type !== "BinaryExpression" || (x.operator !== "!==" && x.operator !== "!=")) return null;
  const [t, u] = x.left.type === "UnaryExpression" ? [x.left, x.right] : [x.right, x.left];
  if (t.type !== "UnaryExpression" || t.operator !== "typeof" || t.argument.type !== "Identifier") return null;
  return u.type === "Literal" && u.value === "undefined" ? t.argument.name : null;
}

/** `typeof` operands (by offset) and the spans a `typeof x !== 'undefined'` test guards, by name. */
function guards(ast: Program): { readonly operands: ReadonlySet<number>; readonly spans: readonly Span[] } {
  const operands = new Set<number>();
  const spans: Span[] = [];
  const guard = (test: Expression, body: { readonly start: number; readonly end: number }): void => {
    const name = definedTest(test);
    if (name !== null) spans.push({ name, start: body.start, end: body.end });
  };
  new Visitor({
    UnaryExpression: (n) => {
      if (n.operator === "typeof" && n.argument.type === "Identifier") operands.add(n.argument.start);
    },
    LogicalExpression: (n) => {
      if (n.operator === "&&") guard(n.left, n.right);
    },
    ConditionalExpression: (n) => guard(n.test, n.consequent),
    IfStatement: (n) => guard(n.test, n.consequent),
  }).visit(ast);
  return { operands, spans };
}

/**
 * E1759 (k.host): in a browser file (`isBrowserFile`), a read of a Node-only global, `import.meta.dirname` or
 * `.filename`, or a value import, re-export or literal `import()` of a Node built-in; in every app file, `require`,
 * `__dirname` and `__filename`, which no ES module has. Names resolve by lexical scope as for E1601; a `typeof`
 * operand, a read a `typeof x !== 'undefined'` test guards and members of `globalThis` are left alone. Fix, outside a
 * browser file: `__dirname` and `__filename` to their `import.meta` names.
 */
export const noNodeGlobal: RuleDef = {
  code: "E1759",
  message: (f) =>
    str(f.data, "kind") === "esm"
      ? `${str(f.data, "name")} is undefined in an ES module; use import or import.meta`
      : `${str(f.data, "name")} is Node-only and ${str(f.data, "file")} runs in the browser; move it to a *.server.ts file`,
  see: "k.host",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path)) return [];
    const browser = isBrowserFile(file.path, project);
    const base = file.path.slice(file.path.lastIndexOf("/") + 1);
    const out: Finding[] = [];
    const node = (at: number, name: string): void =>
      void out.push(findingAt(file, at, { kind: "node", name, file: base }));
    const g = globalRefs(ast);
    const { operands, spans } = guards(ast);
    for (const r of g.refs) {
      const esm = NOT_IN_ESM.get(r.name);
      if (esm === undefined && (!browser || !NODE_ONLY.has(r.name))) continue;
      if (operands.has(r.start) || spans.some((s) => s.name === r.name && s.start <= r.start && r.start < s.end))
        continue;
      if (g.resolveName(r.name, r.start)?.join(".") !== r.name) continue;
      if (esm === undefined) node(r.start, r.name);
      else {
        const use = browser ? "" : esm;
        out.push(findingAt(file, r.start, { kind: "esm", name: r.name, start: r.start, end: r.end, use }));
      }
    }
    if (!browser) return out;
    const builtin = (at: number, spec: string): void => {
      if (isNodeBuiltin(spec)) node(at, `'${spec}'`);
    };
    new Visitor({
      MemberExpression: (n) => {
        if (n.object.type !== "MetaProperty" || n.computed) return;
        if (n.property.name === "dirname" || n.property.name === "filename")
          node(n.start, `import.meta.${n.property.name}`);
      },
      ImportDeclaration: (n) => {
        const types =
          n.specifiers.length > 0 && n.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type");
        if (n.importKind !== "type" && !types) builtin(n.start, n.source.value);
      },
      ExportNamedDeclaration: (n) => {
        if (n.source !== null && n.exportKind !== "type") builtin(n.start, n.source.value);
      },
      ExportAllDeclaration: (n) => {
        if (n.exportKind !== "type") builtin(n.start, n.source.value);
      },
      ImportExpression: (n) => {
        if (n.source.type === "Literal" && typeof n.source.value === "string") builtin(n.start, n.source.value);
      },
    }).visit(ast);
    return out;
  },
  fix: (f) => {
    const use = str(f.data, "use");
    return use === "" ? null : [{ start: num(f.data, "start"), end: num(f.data, "end"), text: use }];
  },
};
