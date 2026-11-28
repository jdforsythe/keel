import type { Argument, Expression, ObjectExpression, PropertyKey } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { SchemaQuestion } from "./SchemaQuestion.ts";
import { followValue } from "./followValue.ts";
import { parseFile } from "./parseFile.ts";
import { schemaRead } from "./schemaRead.ts";

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

type Ns = "yes" | "no" | "unknown";

/** The name a non-computed property key spells. */
function propertyName(key: PropertyKey): string | undefined {
  if (key.type === "Identifier") return key.name;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}

/** The object literal `e` is, directly or through a top-level `const` of `file`; undefined for anything else. */
function objectLiteral(e: Expression, file: SourceFile): ObjectExpression | undefined {
  if (e.type === "ObjectExpression") return e;
  if (e.type !== "Identifier") return undefined;
  for (const st of parseFile(file).program.body) {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d?.type !== "VariableDeclaration" || d.kind !== "const") continue;
    for (const v of d.declarations)
      if (v.id.type === "Identifier" && v.id.name === e.name && v.init?.type === "ObjectExpression") return v.init;
  }
  return undefined;
}

/**
 * Whether `e` in `file` is the `@keel/schema` namespace the `secret` factory hangs off: the `s` import, a namespace
 * import of the package, `ns.s` of that namespace, or a const or project import that leads to one. `no` for a binding
 * that the file can read and that is something else (a literal, a function, a const bound to one, a project import
 * followed to one); `unknown` when the value cannot be read: another package's import (it may re-export `s`), an
 * undeclared name, a call result, a project import it cannot follow.
 */
function schemaNamespace(e: Expression, file: SourceFile, project: readonly SourceFile[], hops = 0): Ns {
  if (hops > 8) return "unknown";
  if (e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression")
    return schemaNamespace(e.expression, file, project, hops + 1);
  if (e.type === "MemberExpression") {
    if (e.computed) return "unknown";
    if (e.object.type === "Identifier" && e.property.name === "s") {
      for (const st of parseFile(file).program.body)
        if (st.type === "ImportDeclaration" && st.importKind !== "type" && st.source.value === "@keel/schema")
          for (const sp of st.specifiers)
            if (sp.type === "ImportNamespaceSpecifier" && sp.local.name === e.object.name) return "yes";
    }
    const literal = objectLiteral(e.object, file);
    if (literal !== undefined) {
      // A member of a local object literal is that property's value; a spread or a missing key cannot be followed.
      for (const p of literal.properties)
        if (p.type === "Property" && !p.computed && p.kind === "init" && propertyName(p.key) === e.property.name)
          return schemaNamespace(p.value, file, project, hops + 1);
      return "unknown";
    }
    return schemaNamespace(e.object, file, project, hops + 1) === "no" ? "no" : "unknown";
  }
  if (e.type === "ObjectExpression" || e.type === "ArrayExpression" || e.type === "Literal") return "no";
  if (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression" || e.type === "TemplateLiteral")
    return "no";
  if (e.type !== "Identifier") return "unknown";
  for (const st of parseFile(file).program.body) {
    if (st.type === "ImportDeclaration") {
      for (const sp of st.specifiers) {
        if (sp.local.name !== e.name) continue;
        if (st.importKind === "type" || (sp.type === "ImportSpecifier" && sp.importKind === "type")) return "no";
        const source = st.source.value;
        if (source === "@keel/schema") {
          if (sp.type === "ImportNamespaceSpecifier") return "yes";
          if (sp.type !== "ImportSpecifier") return "no";
          return (sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value) === "s" ? "yes" : "no";
        }
        if (!source.startsWith(".")) return "unknown";
        if (sp.type === "ImportNamespaceSpecifier") return "unknown";
        const at = followValue(e, file, project);
        if (at === "global" || at === null || at === "package") return "unknown";
        return schemaNamespace(at.expr, at.file, project, hops + 1);
      }
      continue;
    }
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d?.type !== "VariableDeclaration" || d.kind !== "const") continue;
    for (const v of d.declarations)
      if (v.id.type === "Identifier" && v.id.name === e.name && v.init !== null && v.init !== undefined)
        return schemaNamespace(v.init, file, project, hops + 1);
  }
  return "unknown";
}

type Verdict = "marked" | "clean" | "unknown";

/**
 * Whether the schema expression `expr` holds a `.pii(...)` mark or a `secret(...)` call on the `@keel/schema` namespace
 * (k.privacy E1111), read by `schemaRead` (the walk `schemaHolds` exports): `unknown` where a part cannot be read.
 * A package's schema and a name the file never declares are `clean`.
 * A schema returned by a `SEARCH_FACTORIES` export (`tableSearch(columns)`, also through a namespace import) is that
 * package's, as its route table is: `clean` here, guarded by the package's own rule.
 * With `classes`, each literal class a `.pii(class)` names is added to it, the whole schema read (k.leave E1107).
 */
export function schemaMarks(
  expr: Expression | Argument,
  file: SourceFile,
  project: readonly SourceFile[],
  seen: Set<string> = new Set(),
  classes?: Set<string>,
): Verdict {
  const q: SchemaQuestion = {
    pkg: () => "no",
    global: "no",
    call: (e, at, read) => {
      const c = e.callee;
      if (c.type !== "Super" && audited(c, at)) return "no";
      if (c.type !== "MemberExpression" || c.computed) return undefined;
      if (c.property.name === "pii") {
        const k = e.arguments[0];
        if (classes === undefined) return "yes";
        if (k?.type === "Literal" && typeof k.value === "string") classes.add(k.value);
        read(c.object);
        return "yes";
      }
      if (c.property.name !== "secret") return undefined;
      const ns = schemaNamespace(c.object, at, project);
      return ns === "no" ? undefined : ns;
    },
  };
  const v = schemaRead(expr, file, project, q, seen);
  return v === "yes" ? "marked" : v === "no" ? "clean" : "unknown";
}
