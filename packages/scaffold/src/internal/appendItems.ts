import type MagicString from "magic-string";
import type { ArrayExpression } from "oxc-parser";

/** Append string items to an array literal, in the quote style of its existing items (single quotes when empty). */
export function appendItems(ms: MagicString, src: string, arr: ArrayExpression, items: readonly string[]): void {
  if (items.length === 0) return;
  const first = arr.elements.find((e) => e?.type === "Literal");
  const q = first !== undefined && first !== null && src.charAt(first.start) === '"' ? '"' : "'";
  const text = items.map((i) => `${q}${i}${q}`).join(", ");
  const last = arr.elements[arr.elements.length - 1];
  if (last === undefined || last === null) ms.appendLeft(arr.end - 1, text);
  else ms.appendLeft(last.end, `, ${text}`);
}
