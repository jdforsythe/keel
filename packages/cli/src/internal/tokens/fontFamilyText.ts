import type { JsonNode } from "./JsonNode.ts";

const WORD = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** A DTCG font family (a string, a comma list in a string, or an array of strings) as families joined by `, `, any that is not a plain word in `"`; undefined for none, more than eight, or one with a quote, backslash or control character. */
export function fontFamilyText(node: JsonNode): string | undefined {
  const names =
    node.kind === "string"
      ? node.value.split(",")
      : node.kind === "array"
        ? node.items.map((i) => (i.kind === "string" ? i.value : ""))
        : [];
  const families = names.map((n) => n.trim().replace(/^(["'])(.*)\1$/, "$2"));
  if (families.length === 0 || families.length > 8) return undefined;
  const bad = (f: string): boolean =>
    f === "" ||
    /["'\\]/.test(f) ||
    [...f].some((ch) => ch.charCodeAt(0) < 32 || (ch.charCodeAt(0) >= 127 && ch.charCodeAt(0) < 160));
  if (families.some(bad)) return undefined;
  return families.map((f) => (WORD.test(f) ? f : `"${f}"`)).join(", ");
}
