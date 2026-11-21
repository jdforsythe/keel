import type { Expression } from "oxc-parser";
import type { SchemaScope } from "./SchemaScope.ts";
import type { ShapeNode } from "./ShapeNode.ts";
import { argAt } from "./argAt.ts";
import { memberCall } from "./memberCall.ts";
import { parseTs } from "./parseTs.ts";
import { scopeOf } from "./scopeOf.ts";
import { unwrap } from "./unwrap.ts";

const ANY: ShapeNode = { kind: "any" };
const LEAF: ShapeNode = { kind: "leaf" };
const LEAVES = new Set(["string", "number", "int", "boolean", "id", "enum", "literal"]);
const MAX_DEPTH = 8;
const SCHEMA_IMPORT = /^\.\/([^/]+\.schema\.ts)$/;

function imported(name: string, scope: SchemaScope, depth: number): ShapeNode {
  const imp = scope.imports.get(name);
  const m = imp === undefined ? null : SCHEMA_IMPORT.exec(imp.source);
  if (imp === undefined || m === null) return ANY;
  const slash = scope.path.lastIndexOf("/");
  const target = `${scope.path.slice(0, slash + 1)}${m[1] ?? ""}`;
  const file = scope.files.find((f) => f.path === target);
  const program = file === undefined ? undefined : parseTs(file.path, file.source);
  if (file === undefined || program === undefined) return ANY;
  const inner = scopeOf(file.path, program, scope.files);
  const init = inner.consts.get(imp.name);
  return init === undefined ? ANY : resolveSchema(init, inner, depth + 1);
}

/** Reads a schema expression statically; anything it cannot prove becomes `any`. */
export function resolveSchema(expr: Expression, scope: SchemaScope, depth = 0): ShapeNode {
  if (depth > MAX_DEPTH) return ANY;
  const e = unwrap(expr);
  if (e.type === "Identifier") {
    const init = scope.consts.get(e.name);
    return init !== undefined ? resolveSchema(init, scope, depth + 1) : imported(e.name, scope, depth);
  }
  if (e.type !== "CallExpression") return ANY;
  const mc = memberCall(e);
  if (mc === undefined) return ANY;
  const obj = unwrap(mc.object);
  if (obj.type !== "Identifier" || obj.name !== "s") {
    return mc.name === "optional" || mc.name === "nullable" ? resolveSchema(obj, scope, depth + 1) : ANY;
  }
  const a0 = argAt(e, 0);
  if (LEAVES.has(mc.name)) return LEAF;
  if (mc.name === "array" || mc.name === "secret" || mc.name === "record") {
    if (a0 === undefined) return ANY;
    const inner = resolveSchema(a0, scope, depth + 1);
    return mc.name === "array"
      ? { kind: "array", item: inner }
      : mc.name === "record"
        ? { kind: "record", value: inner }
        : inner;
  }
  if (mc.name !== "object" || a0 === undefined) return ANY;
  const lit = unwrap(a0);
  if (lit.type !== "ObjectExpression") return ANY;
  const fields = new Map<string, ShapeNode>();
  let open = false;
  for (const p of lit.properties) {
    const k =
      p.type === "Property" && !p.computed
        ? p.key.type === "Identifier"
          ? p.key.name
          : p.key.type === "Literal" && typeof p.key.value === "string"
            ? p.key.value
            : undefined
        : undefined;
    if (p.type !== "Property" || k === undefined) open = true;
    else fields.set(k, resolveSchema(p.value, scope, depth + 1));
  }
  return { kind: "object", fields, open };
}
