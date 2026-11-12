import type { JsonValue } from "@keel/schema";
import { type Expression, type ObjectExpression, type ObjectProperty, parseSync } from "oxc-parser";
import type { StaticManifest } from "./StaticManifest.ts";

const unwrap = (e: Expression): Expression =>
  e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression" || e.type === "ParenthesizedExpression"
    ? unwrap(e.expression)
    : e;

function keyOf(p: ObjectProperty): string | undefined {
  if (p.computed) return undefined;
  if (p.key.type === "Identifier") return p.key.name;
  return p.key.type === "Literal" && typeof p.key.value === "string" ? p.key.value : undefined;
}

/** Properties of a literal object by key; undefined with a spread or computed key. */
function propsOf(o: ObjectExpression): Map<string, Expression> | undefined {
  const out = new Map<string, Expression>();
  for (const p of o.properties) {
    const k = p.type === "Property" ? keyOf(p) : undefined;
    if (p.type !== "Property" || k === undefined) return undefined;
    out.set(k, unwrap(p.value));
  }
  return out;
}

/** The JSON value of a literal expression, as k.module E1158 reads it (`keel check`'s rule); undefined when not literal. */
function json(e: Expression): JsonValue | undefined {
  switch (e.type) {
    case "ParenthesizedExpression":
      return json(e.expression);
    case "Literal": {
      const v = e.value;
      return v === null ||
        typeof v === "string" ||
        typeof v === "boolean" ||
        (typeof v === "number" && Number.isFinite(v))
        ? v
        : undefined;
    }
    case "UnaryExpression": {
      const v = e.operator === "-" && e.argument.type === "Literal" ? e.argument.value : undefined;
      // `-1e999` is -Infinity, which JSON cannot hold (backlog 0195).
      return typeof v === "number" && Number.isFinite(v) ? 0 - v : undefined;
    }
    case "TemplateLiteral":
      return e.expressions.length === 0 ? (e.quasis[0]?.value.cooked ?? undefined) : undefined;
    case "ArrayExpression": {
      const out: JsonValue[] = [];
      for (const el of e.elements) {
        const v = el === null || el.type === "SpreadElement" ? undefined : json(el);
        if (v === undefined) return undefined;
        out.push(v);
      }
      return out;
    }
    case "ObjectExpression": {
      const out: { [k: string]: JsonValue } = {};
      for (const p of e.properties) {
        if (p.type !== "Property" || p.kind !== "init" || p.method) return undefined;
        const k = keyOf(p);
        const v = k === undefined ? undefined : json(p.value);
        if (k === undefined || v === undefined) return undefined;
        Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
      }
      return out;
    }
    default:
      return undefined;
  }
}

/**
 * Read a `module.ts` manifest statically (rfc:0066): the literal object of `export default module({...})` (or a
 * bare object). `null` when it, its `deps`, or its `std` is not literal (an opaque manifest, as `keel check` reads it).
 */
export function appManifest(source: string): StaticManifest | null {
  const { program, errors } = parseSync("module.ts", source, { sourceType: "module", lang: "ts" });
  const def = errors.length > 0 ? undefined : program.body.find((s) => s.type === "ExportDefaultDeclaration");
  const d = def?.declaration;
  if (d === undefined || d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") return null;
  if (d.type === "TSInterfaceDeclaration") return null;
  let e = unwrap(d);
  if (e.type === "CallExpression") {
    const arg = e.arguments[0];
    if (arg === undefined || arg.type === "SpreadElement") return null;
    e = unwrap(arg);
  }
  const props = e.type === "ObjectExpression" ? propsOf(e) : undefined;
  if (props === undefined) return null;
  const depsNode = props.get("deps");
  const stdNode = props.get("std");
  const deps: { value: string; start: number }[] = [];
  if (depsNode !== undefined) {
    if (depsNode.type !== "ArrayExpression") return null;
    for (const el of depsNode.elements) {
      if (el?.type !== "Literal" || typeof el.value !== "string") return null;
      deps.push({ value: el.value, start: el.start });
    }
  }
  const std: { key: string; start: number; value: JsonValue | undefined }[] = [];
  if (stdNode !== undefined) {
    if (stdNode.type !== "ObjectExpression") return null;
    for (const p of stdNode.properties) {
      const key = p.type === "Property" ? keyOf(p) : undefined;
      if (p.type !== "Property" || key === undefined) return null;
      std.push({ key, start: p.key.start, value: json(p.value) });
    }
  }
  const idNode = props.get("id");
  const id = idNode?.type === "Literal" && typeof idNode.value === "string" ? idNode.value : undefined;
  return { id, deps, std };
}
