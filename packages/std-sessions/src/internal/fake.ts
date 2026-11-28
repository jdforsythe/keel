import { type JsonValue, sampleFormat } from "@keel/schema";
import type { TypeNode } from "./TypeNode.ts";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const HEX = "0123456789abcdef";

const draw = (rand: () => number, alphabet: string, n: number): string =>
  Array.from({ length: n }, () => alphabet[Math.floor(rand() * alphabet.length)] ?? "").join("");

/**
 * A generated JSON value that `node` parses (std.sessions redaction): the smallest shape, with strings and ids drawn
 * from `rand`. Optional object keys are left out; a secret gives its inner value, so the encoded payload still parses.
 */
export function fake(node: TypeNode, rand: () => number): JsonValue {
  switch (node.kind) {
    case "string":
      return draw(rand, LETTERS, Math.max(node.min, Math.min(8, node.max ?? 8)));
    case "number":
    case "int": {
      const lo = node.kind === "int" ? Math.ceil(node.min ?? 0) : (node.min ?? 0);
      return node.max !== undefined && lo > node.max ? node.max : lo;
    }
    case "boolean":
      return false;
    case "literal":
      return node.value;
    case "enum":
      return node.values[Math.floor(rand() * node.values.length)] ?? "";
    case "id":
      return draw(rand, HEX, 32);
    case "json":
    case "nullable":
      return null;
    case "optional":
    case "secret":
      return fake(node.inner, rand);
    case "format":
      return sampleFormat(node, (from) => fake(from, rand)) ?? fake(node.base, rand);
    case "array":
      return [];
    case "record":
      return {};
    case "union":
      return node.variants[0] === undefined ? null : fake(node.variants[0], rand);
    case "anyOf":
      return node.members[0] === undefined ? null : fake(node.members[0], rand);
    case "object": {
      const out: Record<string, JsonValue> = {};
      for (const [k, f] of Object.entries(node.fields)) if (f.kind !== "optional") out[k] = fake(f, rand);
      return out;
    }
  }
}
