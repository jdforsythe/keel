import type { Expression, ObjectExpression, ObjectProperty, Program } from "oxc-parser";
import type { Entry } from "./Entry.ts";
import type { Manifest } from "./Manifest.ts";
import type { ManifestList } from "./ManifestList.ts";

/** The static key of an object property (identifier or string literal), or `null` when computed. */
function keyOf(p: ObjectProperty): string | null {
  if (p.computed) return null;
  if (p.key.type === "Identifier") return p.key.name;
  if (p.key.type !== "Literal") return null;
  const v = p.key.value;
  return typeof v === "string" ? v : null;
}

/** `x as T`, `x satisfies T`, and `(x)` unwrapped. */
function unwrap(e: Expression): Expression {
  let x = e;
  while (x.type === "TSAsExpression" || x.type === "TSSatisfiesExpression" || x.type === "ParenthesizedExpression")
    x = x.expression;
  return x;
}

/** Properties of a literal object by key; `null` when it has a spread or a computed key. */
function propsOf(o: ObjectExpression): Map<string, Expression> | null {
  const out = new Map<string, Expression>();
  for (const p of o.properties) {
    if (p.type !== "Property") return null;
    const k = keyOf(p);
    if (k === null) return null;
    out.set(k, unwrap(p.value));
  }
  return out;
}

/** A literal string array (absent: empty with no span); `null` when it is anything else. */
function listOf(e: Expression | undefined): ManifestList | null {
  if (e === undefined) return { entries: [], span: null };
  if (e.type !== "ArrayExpression") return null;
  const entries: Entry[] = [];
  for (const el of e.elements) {
    if (el === null || el.type !== "Literal") return null;
    const v = el.value;
    if (typeof v !== "string") return null;
    entries.push({ value: v, start: el.start, end: el.end });
  }
  return { entries, span: { start: e.start, end: e.end } };
}

/** The literal object passed to the default export `module({...})` (or a bare default object literal). */
function manifestObject(program: Program): ObjectExpression | null {
  for (const st of program.body) {
    if (st.type !== "ExportDefaultDeclaration") continue;
    const d = st.declaration;
    if (d.type === "ObjectExpression") return d;
    if (d.type !== "CallExpression" && d.type !== "TSAsExpression" && d.type !== "TSSatisfiesExpression") return null;
    const call = unwrap(d);
    if (call.type === "ObjectExpression") return call;
    if (call.type !== "CallExpression") return null;
    const arg = call.arguments[0];
    if (arg === undefined || arg.type === "SpreadElement") return null;
    const obj = unwrap(arg);
    return obj.type === "ObjectExpression" ? obj : null;
  }
  return null;
}

/**
 * Read a `module.ts` manifest statically (literal objects and string arrays only). `null` when the default export
 * is not such a literal; absent lists read as empty. Schema validity is `module()`'s job at build time.
 */
export function readManifest(program: Program): Manifest | null {
  const obj = manifestObject(program);
  if (obj === null) return null;
  const props = propsOf(obj);
  if (props === null) return null;
  const idNode = props.get("id");
  const idValue = idNode?.type === "Literal" ? idNode.value : null;
  const pub = props.get("public");
  const pubProps =
    pub === undefined ? new Map<string, Expression>() : pub.type === "ObjectExpression" ? propsOf(pub) : null;
  if (pubProps === null) return null;
  const deps = listOf(props.get("deps"));
  const capabilities = listOf(props.get("capabilities"));
  const exports = listOf(pubProps.get("exports"));
  const routes = listOf(pubProps.get("routes"));
  if (deps === null || capabilities === null || exports === null || routes === null) return null;
  return { id: typeof idValue === "string" ? idValue : null, deps, capabilities, exports, routes };
}
