import type { Doc } from "./Doc.ts";
import type { Gen } from "./Gen.ts";
import type { Path } from "./Path.ts";
import { bounds } from "./bounds.ts";
import { isRecord } from "./isRecord.ts";
import { keyText } from "./keyText.ts";
import { make } from "./make.ts";
import { namedRef } from "./namedRef.ts";
import { resolve } from "./resolve.ts";

const JSON_ANY = "s.json()";
type Node = Readonly<Record<string, unknown>>;

/** The non-null `type` of a node (`type: [T, 'null']` is T), or undefined when absent or ambiguous. */
function typeOf(n: Node): string | undefined {
  if (typeof n.type === "string") return n.type;
  if (!Array.isArray(n.type)) return n.type === undefined && isObjectLike(n) ? "object" : undefined;
  const named = n.type.filter((t): t is string => typeof t === "string" && t !== "null");
  return named.length === 1 ? named[0] : undefined;
}

/** An untyped node that still describes an object: it has `properties` or an `additionalProperties` schema/false. */
function isObjectLike(n: Node): boolean {
  return isRecord(n.properties) || isRecord(n.additionalProperties) || n.additionalProperties === false;
}

function isNullable(n: Node): boolean {
  return (
    n.nullable === true ||
    (Array.isArray(n.type) && n.type.includes("null")) ||
    (Array.isArray(n.enum) && n.enum.includes(null))
  );
}

function objectSource(g: Gen, n: Node, at: Path, refs: ReadonlySet<string>): Doc {
  const props = isRecord(n.properties) ? n.properties : undefined;
  if (props === undefined || Object.keys(props).length === 0) {
    const extra = n.additionalProperties;
    if (extra === false) return "s.object({}, { closed: true })";
    return make.call(
      "s.record",
      isRecord(extra) ? schemaSource(g, extra, [...at, "additionalProperties"], refs) : JSON_ANY,
    );
  }
  const required = new Set(Array.isArray(n.required) ? n.required : []);
  const fields = Object.entries(props).map(([k, v]): [string, Doc] => {
    const src = schemaSource(g, v, [...at, "properties", k], refs);
    return [keyText(k), required.has(k) ? src : make.chain(src, ".optional()")];
  });
  const shape = make.obj(fields);
  return n.additionalProperties === false
    ? make.call("s.object", shape, "{ closed: true }")
    : make.call("s.object", shape);
}

function members(g: Gen, list: readonly unknown[], at: Path, refs: ReadonlySet<string>): Doc {
  const srcs = list.map((m, i) => schemaSource(g, m, [...at, i], refs));
  return srcs.length === 1 ? (srcs[0] ?? JSON_ANY) : make.call("s.union", make.arr(srcs));
}

function bare(g: Gen, n: Node, at: Path, refs: ReadonlySet<string>): Doc {
  if (typeof n.const === "string" || typeof n.const === "number" || typeof n.const === "boolean")
    return `s.literal(${JSON.stringify(n.const)})`;
  if (Array.isArray(n.enum)) {
    const values = n.enum.filter((v) => v !== null);
    return values.length > 0 && values.every((v) => typeof v === "string")
      ? make.call("s.enum", make.arr(values.map((v) => JSON.stringify(v))))
      : JSON_ANY;
  }
  for (const key of ["oneOf", "anyOf"]) {
    const list = n[key];
    if (Array.isArray(list) && list.length > 0) return members(g, list, [...at, key], refs);
  }
  switch (typeOf(n)) {
    case "string":
      return `s.string(${bounds(g, n, at, "minLength", "maxLength")})`;
    case "integer":
      return `s.int(${bounds(g, n, at, "minimum", "maximum")})`;
    case "number":
      return `s.number(${bounds(g, n, at, "minimum", "maximum")})`;
    case "boolean":
      return "s.boolean()";
    case "array":
      return make.call("s.array", n.items === undefined ? JSON_ANY : schemaSource(g, n.items, [...at, "items"], refs));
    case "object":
      return objectSource(g, n, at, refs);
    default:
      return JSON_ANY;
  }
}

/**
 * The `s` schema for one JSON Schema node; unsupported constructs are `s.json()`. A ref to
 * `#/components/schemas/<Name>` is the local const `<Name>`, generated once (issues at the component's path); other
 * local refs are inlined. A ref met again on its own branch is a cycle.
 */
export function schemaSource(g: Gen, node: unknown, at: Path, refs: ReadonlySet<string> = new Set()): Doc {
  const name = namedRef(g, node);
  if (name !== undefined) {
    const ref = `#/components/schemas/${name}`;
    if (refs.has(ref)) {
      g.issues.push({ path: [...at, "$ref"], rule: "type" });
      return JSON_ANY;
    }
    if (g.named.has(name)) return name;
    const schemas = isRecord(g.doc.components) ? g.doc.components.schemas : undefined;
    if (!isRecord(schemas) || !Object.hasOwn(schemas, name)) {
      g.issues.push({ path: [...at, "$ref"], rule: "required" });
      return JSON_ANY;
    }
    const src = schemaSource(g, schemas[name], ["components", "schemas", name], new Set([...refs, ref]));
    g.named.set(name, src);
    return name;
  }
  const r = resolve(g, node, at, refs);
  if (r === undefined || !isRecord(r.node)) return JSON_ANY;
  const src = bare(g, r.node, at, r.refs);
  return isNullable(r.node) && src !== JSON_ANY ? make.chain(src, ".nullable()") : src;
}
