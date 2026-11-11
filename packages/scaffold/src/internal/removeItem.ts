import type { ArrayExpression } from "oxc-parser";

/** Remove the string item `id` from an array literal with its separator: the inverse of `insertItem`. */
export function removeItem(src: string, list: ArrayExpression, id: string): string {
  const items = list.elements.filter((e) => e !== null && e.type !== "SpreadElement");
  const i = items.findIndex((e) => e.type === "Literal" && e.value === id);
  const item = items[i];
  if (item === undefined) return src;
  const next = items[i + 1];
  const prev = items[i - 1];
  const [from, to] =
    next !== undefined ? [item.start, next.start] : prev !== undefined ? [prev.end, item.end] : [item.start, item.end];
  return `${src.slice(0, from)}${src.slice(to)}`;
}
