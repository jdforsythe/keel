import type { Argument, Expression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { followValue } from "./followValue.ts";
import { parseFile } from "./parseFile.ts";

/**
 * Stdlib exports whose return value is a route schema the package guards itself (it refuses a `.pii()` mark when it
 * is called): `tableSearch` throws E2852 for a marked `search` column. Only these, by package and export name.
 */
const SEARCH_FACTORIES: ReadonlyMap<string, readonly string[]> = new Map([["@keel/std-tables", ["tableSearch"]]]);

/** True when `callee` in `file` is a `SEARCH_FACTORIES` export: imported by name, or a member of a namespace import. */
function audited(callee: Expression, file: SourceFile): boolean {
  const member = callee.type === "MemberExpression" && !callee.computed ? callee : null;
  const local = member?.object ?? callee;
  if (local.type !== "Identifier") return false;
  for (const st of parseFile(file).program.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
    const names = SEARCH_FACTORIES.get(st.source.value);
    if (names === undefined) continue;
    for (const sp of st.specifiers) {
      if (sp.local.name !== local.name) continue;
      if (member !== null) return sp.type === "ImportNamespaceSpecifier" && names.includes(member.property.name);
      if (sp.type === "ImportSpecifier" && sp.importKind !== "type") {
        const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
        return names.includes(imported);
      }
    }
  }
  return false;
}

type Verdict = "marked" | "clean" | "unknown";
const worst = (a: Verdict, b: Verdict): Verdict =>
  a === "marked" || b === "marked" ? "marked" : a === "unknown" || b === "unknown" ? "unknown" : "clean";

/**
 * Whether the schema expression `expr` holds a `.pii(...)` mark or an `s.secret(...)` node (k.privacy E1111), read through consts, imports,
 * re-exports, namespace members, spreads, array and object arguments and schema method chains. `unknown` when a
 * part cannot be read statically: a call whose callee is not a member (a factory), or a binding it cannot follow.
 * A schema returned by a `SEARCH_FACTORIES` export (`tableSearch(columns)`, also through a namespace import) is that
 * package's, as its route table is: `clean` here, guarded by the package's own rule.
 */
export function schemaMarks(
  expr: Expression | Argument,
  file: SourceFile,
  project: readonly SourceFile[],
  seen: Set<string> = new Set(),
): Verdict {
  if (expr.type === "SpreadElement") return schemaMarks(expr.argument, file, project, seen);
  const at = followValue(expr, file, project);
  if (at === "package" || at === "global") return "clean";
  if (at === null) return "unknown";
  const key = `${at.file.path}:${at.expr.start}:${at.expr.end}`;
  if (seen.has(key)) return "clean";
  seen.add(key);
  const e = at.expr;
  const sub = (x: Expression | Argument | null): Verdict =>
    x === null ? "clean" : schemaMarks(x, at.file, project, seen);
  switch (e.type) {
    case "CallExpression": {
      const c = e.callee;
      if (c.type !== "Super" && audited(c, at.file)) return "clean";
      if (c.type !== "MemberExpression" || c.computed) return "unknown";
      if (c.property.name === "pii" || c.property.name === "secret") return "marked";
      // `s.object(...)` reads `s` from a package; `X.optional()` reads `X`.
      return e.arguments.map(sub).reduce(worst, sub(c.object));
    }
    case "ObjectExpression":
      return e.properties.map((p) => (p.type === "Property" ? sub(p.value) : sub(p))).reduce(worst, "clean");
    case "ArrayExpression":
      return e.elements.map((x) => (x === null ? "clean" : sub(x))).reduce(worst, "clean");
    case "ConditionalExpression":
      return worst(sub(e.consequent), sub(e.alternate));
    case "MemberExpression":
      return e.computed ? "unknown" : sub(e.object);
    case "Literal":
    case "TemplateLiteral":
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "UnaryExpression":
      return "clean";
    default:
      return "unknown";
  }
}
