import type { Schema } from "@keel/schema";

/** The largest payload domain `explore` enumerates from a schema (k.model). */
const MAX_DOMAIN = 256;
type Node = Schema<unknown>["node"];
const ABSENT = Symbol("absent");

function values(node: Node): unknown[] | undefined {
  switch (node.kind) {
    case "literal":
      return [node.value];
    case "enum":
      return [...node.values];
    case "boolean":
      return [false, true];
    case "int": {
      if (node.min === undefined || node.max === undefined) return undefined;
      const lo = Math.ceil(node.min);
      const n = Math.floor(node.max) - lo + 1;
      return n > MAX_DOMAIN ? undefined : Array.from({ length: Math.max(0, n) }, (_, i) => lo + i);
    }
    case "optional": {
      const inner = values(node.inner);
      return inner === undefined ? undefined : [ABSENT, ...inner];
    }
    case "union":
    case "anyOf": {
      const out: unknown[] = [];
      for (const member of node.kind === "union" ? node.variants : node.members) {
        const vs = values(member);
        if (vs === undefined || out.length + vs.length > MAX_DOMAIN) return undefined;
        out.push(...vs);
      }
      return out;
    }
    case "object": {
      // Declaration order of keys, the last key varying fastest.
      let out: Record<string, unknown>[] = [{}];
      for (const [key, field] of Object.entries(node.fields)) {
        const vs = values(field);
        if (vs === undefined || out.length * vs.length > MAX_DOMAIN) return undefined;
        out = out.flatMap((o) => vs.map((v) => (v === ABSENT ? o : { ...o, [key]: v })));
      }
      return out;
    }
    default:
      return undefined;
  }
}

/**
 * Every value of `schema` in domain order when it is finite (literals, enums, booleans, integers with `min` and `max`,
 * and objects, unions and optionals of finite parts) and holds at most 256 values; else `undefined`.
 */
export function domainOf(schema: Schema<unknown>): unknown[] | undefined {
  return values(schema.node);
}
