import type { Argument, Expression, ObjectProperty } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { SchemaSource } from "./SchemaSource.ts";
import { importTarget } from "./importTarget.ts";
import { parseFile } from "./parseFile.ts";
import { schemaSourceOf } from "./schemaSourceOf.ts";

const MAX_HOPS = 8;
type Walk = { readonly project: readonly SourceFile[]; readonly seen: Map<string, number> };

/** A static property key's name, or undefined for a computed or non-string key. */
function keyOf(p: ObjectProperty): string | undefined {
  if (p.computed) return undefined;
  if (p.key.type === "Identifier") return p.key.name;
  return p.key.type === "Literal" && typeof p.key.value === "string" ? p.key.value : undefined;
}

/** Resolves `name` in `src`: a const costs one of the `MAX_HOPS` bindings, an import alias none. */
function binding(name: string, src: SchemaSource, path: readonly string[], hops: number, w: Walk): string[] | null {
  const key = `${src.path}#${name}`;
  const prior = w.seen.get(key);
  if (prior !== undefined && prior <= hops) return null;
  w.seen.set(key, hops);
  const init = src.consts.get(name);
  if (init !== undefined) return hops >= MAX_HOPS ? null : walk(init, src, path, hops + 1, w);
  const imp = src.imports.get(name);
  const file = imp === undefined ? undefined : importTarget(src.path, imp.source, w.project);
  if (imp === undefined || file === undefined) return null;
  const parsed = parseFile(file);
  if (!parsed.ok) return null;
  return binding(imp.name, schemaSourceOf(file.path, parsed.program), path, hops, w);
}

function walkAll(
  args: readonly (Argument | null)[],
  src: SchemaSource,
  path: readonly string[],
  hops: number,
  w: Walk,
) {
  for (const a of args) {
    if (a === null || a.type === "SpreadElement") continue;
    const hit = walk(a, src, path, hops, w);
    if (hit !== null) return hit;
  }
  return null;
}

function walk(e: Expression, src: SchemaSource, path: readonly string[], hops: number, w: Walk): string[] | null {
  if (e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression")
    return walk(e.expression, src, path, hops, w);
  if (e.type === "Identifier") return binding(e.name, src, path, hops, w);
  if (e.type === "ArrayExpression") return walkAll(e.elements, src, path, hops, w);
  if (e.type === "ObjectExpression") {
    for (const p of e.properties) {
      if (p.type !== "Property") continue;
      const k = keyOf(p);
      if (k === undefined) continue;
      const hit = walk(p.value, src, [...path, k], hops, w);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (e.type !== "CallExpression" || e.callee.type !== "MemberExpression" || e.callee.computed) return null;
  const obj = e.callee.object;
  if (obj.type === "Identifier" && src.s.has(obj.name)) {
    const factory = e.callee.property.type === "Identifier" ? e.callee.property.name : "";
    return factory === "secret" ? [...path] : walkAll(e.arguments, src, path, hops, w);
  }
  return walk(obj, src, path, hops, w) ?? walkAll(e.arguments, src, path, hops, w);
}

/**
 * The field path (`creds.token`) at which the schema `expr` in `src` holds `s.secret`, read statically: `s` factory
 * chains and their arguments, methods on a schema (`.optional()`, `Base.extend({ ... })`) and their arguments, top-level consts, and named imports from
 * relative specifiers into `project` files, through at most 8 consts (an import alias costs none), a binding read again
 * only when reached in fewer. `null` when none is found;
 * what cannot be resolved (parameters, package imports, other calls) holds none.
 */
export function secretPath(expr: Expression, src: SchemaSource, project: readonly SourceFile[]): string | null {
  const hit = walk(expr, src, [], 0, { project, seen: new Map() });
  return hit === null ? null : hit.join(".");
}
