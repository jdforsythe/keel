import type { ArrayExpression } from "oxc-parser";

/**
 * Insert the string `id` into an array literal before the first string item that sorts after it (else at the end),
 * in the quote style of its items, so a sorted list stays sorted and `removeItem` restores the exact bytes.
 */
export function insertItem(src: string, list: ArrayExpression, id: string): string {
  const items = list.elements.filter((e) => e !== null && e.type !== "SpreadElement");
  const first = items.find((e) => e.type === "Literal");
  const q = first !== undefined && src.charAt(first.start) === "'" ? "'" : '"';
  const text = `${q}${id}${q}`;
  const after = items.find((e) => e.type === "Literal" && typeof e.value === "string" && e.value > id);
  if (after !== undefined) return `${src.slice(0, after.start)}${text}, ${src.slice(after.start)}`;
  const last = items[items.length - 1];
  if (last === undefined) return `${src.slice(0, list.end - 1)}${text}${src.slice(list.end - 1)}`;
  return `${src.slice(0, last.end)}, ${text}${src.slice(last.end)}`;
}
