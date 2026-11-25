import type { Expression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { ReferenceUse } from "./ReferenceUse.ts";
import { callsByStart } from "./callsByStart.ts";
import { importIndex } from "./importIndex.ts";
import { isSchemaNamespace } from "./isSchemaNamespace.ts";
import { parseFile } from "./parseFile.ts";
import { refUse } from "./refUse.ts";
import { topRefs } from "./topRefs.ts";

const memo = new WeakMap<readonly SourceFile[], Map<string, boolean>>();

/** `e` with parentheses, `as` and `satisfies` removed. */
function unwrap(e: Expression): Expression {
  return e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? unwrap(e.expression)
    : e;
}

/**
 * Whether every reference to the literal binding `name` of `file` (a top-level `const` bound to an object or array
 * literal), `exported` when it is exported where declared, is one the read takes (k.privacy-reads Held): by lexical
 * scope in `file`, in each project file importing it by name, through re-exports and `export *`, or as `ns.<name>` of a
 * namespace import, and through each top-level `const` whose initializer carries it, which must be held too.
 */
function bindingHeld(file: SourceFile, name: string, exported: boolean, project: readonly SourceFile[]): boolean {
  const index = importIndex(project);
  const locals: [SourceFile, string][] = [[file, name]];
  const pairs: [SourceFile, string][] = exported ? [[file, name]] : [];
  const seen = new Set<string>();
  const once = (kind: string, f: SourceFile, n: string): boolean => {
    const key = `${kind}\u0000${f.path}\u0000${n}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const accept = (h: SourceFile, use: ReferenceUse): boolean => {
    switch (use.kind) {
      case "taken":
        return true;
      case "alias":
        locals.push([h, use.name]);
        if (use.exported) pairs.push([h, use.name]);
        return true;
      case "export":
        pairs.push([h, use.name]);
        return true;
      case "argument": {
        const callee = callsByStart(parseFile(h).program).get(use.call)?.callee;
        return callee?.type === "MemberExpression" && !callee.computed && isSchemaNamespace(callee.object, h, project);
      }
      default:
        return false;
    }
  };
  while (locals.length > 0 || pairs.length > 0) {
    const local = locals.pop();
    if (local !== undefined) {
      const [h, n] = local;
      if (!once("local", h, n)) continue;
      for (const ref of topRefs(parseFile(h).program).get(n) ?? [])
        if (!accept(h, refUse(ref.links, ref.links.length - 1))) return false;
      continue;
    }
    const pair = pairs.pop();
    if (pair === undefined) break;
    const [g, x] = pair;
    if (!once("pair", g, x)) continue;
    for (const entry of index.get(g.path) ?? []) {
      if (entry.kind === "import") {
        if (entry.imported === x) locals.push([entry.from, entry.local]);
      } else if (entry.kind === "reexport") {
        if (entry.imported === x) pairs.push([entry.from, entry.exported]);
      } else if (entry.kind === "star") {
        if (x !== "default") pairs.push([entry.from, x]);
      } else if (entry.kind === "namespace") {
        for (const ref of topRefs(parseFile(entry.from).program).get(entry.local) ?? []) {
          const up = ref.links.at(-1);
          const property = up?.node.property;
          const member =
            up?.node.type === "MemberExpression" &&
            up.key === "object" &&
            up.node.computed !== true &&
            typeof property === "object" &&
            property !== null &&
            "name" in property;
          if (!member || typeof property.name !== "string") return false;
          if (property.name === x && !accept(entry.from, refUse(ref.links, ref.links.length - 2))) return false;
        }
      } else return false;
    }
  }
  return true;
}

/**
 * Whether the read may take `expr` of `file` (k.privacy-reads Held): true unless `expr` sits in the initializer of a
 * top-level `const` bound to an object or array literal (`as` and `satisfies` passed over) that is not held, every
 * reference to it in the checked files `project` being one the read takes (`bindingHeld`). A schema value needs no
 * such rule: `@keel/schema` freezes it (k.schema Frozen).
 */
export function held(expr: Expression, file: SourceFile, project: readonly SourceFile[]): boolean {
  for (const st of parseFile(file).program.body) {
    const exported = st.type === "ExportNamedDeclaration";
    const d = exported ? st.declaration : st;
    if (d?.type !== "VariableDeclaration") continue;
    for (const v of d.declarations) {
      const init = v.init;
      if (init === null || init === undefined || init.start > expr.start || expr.end > init.end) continue;
      const literal = unwrap(init);
      if (d.kind !== "const" || v.id.type !== "Identifier") return true;
      if (literal.type !== "ObjectExpression" && literal.type !== "ArrayExpression") return true;
      const byProject = memo.get(project) ?? new Map<string, boolean>();
      memo.set(project, byProject);
      const key = `${file.path}\u0000${v.id.name}`;
      const known = byProject.get(key);
      if (known !== undefined) return known;
      const answer = bindingHeld(file, v.id.name, exported, project);
      byProject.set(key, answer);
      return answer;
    }
  }
  return true;
}
