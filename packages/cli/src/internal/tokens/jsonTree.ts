import type { JsonMember } from "./JsonMember.ts";
import type { JsonNode } from "./JsonNode.ts";

const MAX_DEPTH = 100;
const WORDS: readonly (readonly [string, boolean | null])[] = [
  ["true", true],
  ["false", false],
  ["null", null],
];
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/**
 * `text` as a JSON tree that remembers where each value and each key begins, or undefined when `text` is not JSON (or
 * nests more than 100 deep). Strings are decoded as `JSON.parse` decodes them; a repeated key keeps both members.
 */
export function jsonTree(text: string): JsonNode | undefined {
  let i = 0;
  const space = (): void => {
    while (i < text.length && (text[i] === " " || text[i] === "\n" || text[i] === "\r" || text[i] === "\t")) i++;
  };
  const string = (): string | undefined => {
    const from = i;
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") i++;
      i++;
    }
    if (i >= text.length) return undefined;
    i++;
    try {
      const v: unknown = JSON.parse(text.slice(from, i));
      return typeof v === "string" ? v : undefined;
    } catch {
      return undefined;
    }
  };
  const value = (depth: number): JsonNode | undefined => {
    if (depth > MAX_DEPTH) return undefined;
    space();
    const at = i;
    const c = text[i];
    if (c === "{") {
      i++;
      const members: JsonMember[] = [];
      space();
      if (text[i] === "}") {
        i++;
        return { kind: "object", at, members };
      }
      for (;;) {
        space();
        if (text[i] !== '"') return undefined;
        const keyAt = i;
        const key = string();
        if (key === undefined) return undefined;
        space();
        if (text[i] !== ":") return undefined;
        i++;
        const v = value(depth + 1);
        if (v === undefined) return undefined;
        members.push({ key, keyAt, value: v });
        space();
        if (text[i] === ",") i++;
        else if (text[i] === "}") {
          i++;
          return { kind: "object", at, members };
        } else return undefined;
      }
    }
    if (c === "[") {
      i++;
      const items: JsonNode[] = [];
      space();
      if (text[i] === "]") {
        i++;
        return { kind: "array", at, items };
      }
      for (;;) {
        const v = value(depth + 1);
        if (v === undefined) return undefined;
        items.push(v);
        space();
        if (text[i] === ",") i++;
        else if (text[i] === "]") {
          i++;
          return { kind: "array", at, items };
        } else return undefined;
      }
    }
    if (c === '"') {
      const v = string();
      return v === undefined ? undefined : { kind: "string", at, value: v };
    }
    for (const [word, v] of WORDS) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return { kind: "literal", at, value: v };
      }
    }
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(text);
    if (m === null) return undefined;
    i += m[0].length;
    return { kind: "number", at, value: Number(m[0]) };
  };
  const root = value(0);
  if (root === undefined) return undefined;
  space();
  return i === text.length ? root : undefined;
}
