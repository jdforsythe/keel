import type { Expression, ModuleExportName, Program } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Followed } from "./Followed.ts";
import { importTarget } from "./importTarget.ts";
import { parseFile } from "./parseFile.ts";

const MAX_HOPS = 16;
type Ref = { readonly source: string; readonly name: string };
type Scope = {
  readonly consts: ReadonlyMap<string, Expression>;
  /** Local name -> import (`name` `*` for a namespace import). */
  readonly imports: ReadonlyMap<string, Ref>;
  /** Exported name -> local name (`export { a as b }`, `export const`). */
  readonly locals: ReadonlyMap<string, string>;
  /** Exported name -> re-export (`export { a as b } from`, `export * as b from`). */
  readonly reexports: ReadonlyMap<string, Ref>;
  /** `export * from` sources. */
  readonly stars: readonly string[];
  /** Every name declared at the top level. */
  readonly declared: ReadonlySet<string>;
};

const nameOf = (n: ModuleExportName): string => (n.type === "Literal" ? n.value : n.name);
const scopes = new WeakMap<Program, Scope>();

function scopeOf(program: Program): Scope {
  const known = scopes.get(program);
  if (known !== undefined) return known;
  const consts = new Map<string, Expression>();
  const imports = new Map<string, Ref>();
  const locals = new Map<string, string>();
  const reexports = new Map<string, Ref>();
  const stars: string[] = [];
  const declared = new Set<string>();
  for (const st of program.body) {
    const d = st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration" ? st.declaration : st;
    if (d?.type === "VariableDeclaration")
      for (const v of d.declarations) if (v.id.type === "Identifier") declared.add(v.id.name);
    if ((d?.type === "FunctionDeclaration" || d?.type === "ClassDeclaration") && d.id !== null) declared.add(d.id.name);
    if (st.type === "ImportDeclaration") {
      for (const sp of st.specifiers) {
        const name =
          sp.type === "ImportSpecifier"
            ? nameOf(sp.imported)
            : sp.type === "ImportNamespaceSpecifier"
              ? "*"
              : "default";
        imports.set(sp.local.name, { source: st.source.value, name });
        declared.add(sp.local.name);
      }
    } else if (st.type === "ExportAllDeclaration") {
      if (st.exported === null) stars.push(st.source.value);
      else reexports.set(nameOf(st.exported), { source: st.source.value, name: "*" });
    } else if (st.type === "ExportNamedDeclaration" && st.source !== null) {
      for (const sp of st.specifiers)
        reexports.set(nameOf(sp.exported), { source: st.source.value, name: nameOf(sp.local) });
    } else if (st.type === "ExportNamedDeclaration") {
      for (const sp of st.specifiers) locals.set(nameOf(sp.exported), nameOf(sp.local));
    }
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl?.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    for (const d of decl.declarations)
      if (d.id.type === "Identifier" && d.init !== null && d.init !== undefined) {
        consts.set(d.id.name, d.init);
        if (st.type === "ExportNamedDeclaration") locals.set(d.id.name, d.id.name);
      }
  }
  const scope = { consts, imports, locals, reexports, stars, declared };
  scopes.set(program, scope);
  return scope;
}

/** The export `name` of `file`: a const, a local alias, a re-export or an `export *` source. */
function exported(name: string, file: SourceFile, project: readonly SourceFile[], hops: number): Followed {
  if (hops > MAX_HOPS) return null;
  const scope = scopeOf(parseFile(file).program);
  const local = scope.locals.get(name);
  if (local !== undefined) return binding(local, file, project, hops + 1);
  const re = scope.reexports.get(name);
  if (re !== undefined) return imported(re, file, project, hops + 1);
  for (const source of scope.stars) {
    const target = importTarget(file.path, source, project);
    const hit = target === undefined ? null : exported(name, target, project, hops + 1);
    if (hit !== null) return hit;
  }
  return null;
}

function imported(ref: Ref, file: SourceFile, project: readonly SourceFile[], hops: number): Followed {
  if (!ref.source.startsWith(".")) return "package";
  const target = importTarget(file.path, ref.source, project);
  return target === undefined || ref.name === "*" ? null : exported(ref.name, target, project, hops);
}

function binding(name: string, file: SourceFile, project: readonly SourceFile[], hops: number): Followed {
  if (hops > MAX_HOPS) return null;
  const scope = scopeOf(parseFile(file).program);
  const init = scope.consts.get(name);
  if (init !== undefined) return followValue(init, file, project, hops + 1);
  const ref = scope.imports.get(name);
  if (ref !== undefined) return imported(ref, file, project, hops + 1);
  return scope.declared.has(name) ? null : "global";
}

/**
 * `expr` in `file` followed to the expression it names: parentheses and `as`/`satisfies` removed, an identifier to
 * its top-level `const` or through imports, re-exports and `export *` of project files, and `ns.Name` of a namespace
 * import to that file's export. A binding from a package is `"package"`, a name the file never
 * declares `"global"`; anything else it cannot follow is `null`.
 */
export function followValue(expr: Expression, file: SourceFile, project: readonly SourceFile[], hops = 0): Followed {
  if (hops > MAX_HOPS) return null;
  if (
    expr.type === "ParenthesizedExpression" ||
    expr.type === "TSAsExpression" ||
    expr.type === "TSSatisfiesExpression"
  )
    return followValue(expr.expression, file, project, hops);
  if (expr.type === "Identifier") return binding(expr.name, file, project, hops);
  if (expr.type === "MemberExpression" && !expr.computed && expr.object.type === "Identifier") {
    const ref = scopeOf(parseFile(file).program).imports.get(expr.object.name);
    if (ref?.name === "*") {
      if (!ref.source.startsWith(".")) return "package";
      const target = importTarget(file.path, ref.source, project);
      return target === undefined ? null : exported(expr.property.name, target, project, hops + 1);
    }
  }
  return { expr, file };
}
