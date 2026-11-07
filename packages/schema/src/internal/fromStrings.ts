import type { Node } from "./Node.ts";
import { leafFromString } from "./leafFromString.ts";

type Entries = ReadonlyMap<string, readonly string[]>;
const BAD_JSON = Symbol("not json");
const LEAVES = ["string", "number", "int", "boolean", "literal", "enum", "id"];

const under = (entries: Entries, key: string): string[] =>
  [...entries.keys()].filter((k) => k.startsWith(`${key}.`) || k === key || k === `${key}[]`);
const join = (prefix: string, name: string): string => (prefix === "" ? name : `${prefix}.${name}`);
const unwrap = (node: Node): Node =>
  node.kind === "optional" || node.kind === "nullable" || node.kind === "secret" ? unwrap(node.inner) : node;

/**
 * Build the candidate value for `node` from string entries stored under `key`; `undefined` means absent.
 * It only reshapes: a string that cannot be coerced is left as is, so `parse` reports it at its path.
 */
export function fromStrings(node: Node, key: string, entries: Entries): unknown {
  const fieldsOf = (fields: Readonly<Record<string, Node>>): unknown =>
    Object.fromEntries(
      Object.entries(fields)
        .map(([name, f]) => [name, fromStrings(f, join(key, name), entries)] as const)
        .filter(([, v]) => v !== undefined),
    );
  if (key === "" && node.kind === "object") return fieldsOf(node.fields);
  if (node.kind === "secret") return fromStrings(node.inner, key, entries);
  if (node.kind === "optional") {
    if (under(entries, key).length === 0) return undefined;
    const v = fromStrings(node.inner, key, entries);
    return v === "" ? undefined : v;
  }
  if (node.kind === "nullable") {
    const v = fromStrings(node.inner, key, entries);
    return v === undefined || v === "" ? null : v;
  }
  if (node.kind === "json") {
    const text = entries.get(key)?.[0];
    if (text === undefined || text === "") return text;
    try {
      return JSON.parse(text);
    } catch {
      return BAD_JSON;
    }
  }
  if (LEAVES.includes(node.kind)) {
    const text = entries.get(key)?.[0];
    if (text === undefined) return node.kind === "boolean" ? false : undefined;
    return leafFromString(node, text);
  }
  if (node.kind === "array") {
    const texts = [...(entries.get(key) ?? []), ...(entries.get(`${key}[]`) ?? [])];
    return texts.length === 0 ? undefined : texts.map((t) => leafFromString(node.item, t));
  }
  const present = under(entries, key);
  if (present.length === 0) return undefined;
  if (node.kind === "object") return fieldsOf(node.fields);
  if (node.kind === "union") {
    const tag = entries.get(`${key}.${node.key}`)?.[0];
    const variant = node.variants.find((v) => {
      const f = v.kind === "object" ? v.fields[node.key] : undefined;
      return f?.kind === "literal" && String(f.value) === tag;
    });
    return variant?.kind === "object"
      ? fieldsOf(variant.fields)
      : Object.fromEntries(tag === undefined ? [] : [[node.key, tag]]);
  }
  if (node.kind === "record") {
    const leaf = LEAVES.includes(unwrap(node.value).kind);
    const rest = present.filter((k) => k.startsWith(`${key}.`)).map((k) => k.slice(key.length + 1));
    const names = new Set(leaf ? rest : rest.map((r) => r.split(".")[0] ?? r));
    return Object.fromEntries(
      [...names]
        .map((n) => [n, fromStrings(node.value, `${key}.${n}`, entries)] as const)
        .filter(([, v]) => v !== undefined),
    );
  }
  return undefined;
}
