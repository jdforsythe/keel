import { bind } from "../internal/bind.ts";
import { idOf } from "../internal/idOf.ts";
import type { Value } from "../types/Value.ts";

const toText = (v: Value): string => (v === null || v === undefined || typeof v === "boolean" ? "" : String(v));

/**
 * Bind the text of `node` to `fn`. A text node's data is set; an element's single text child is updated
 * in place (else its text content is replaced). Equal values do not touch the DOM.
 */
export function text(node: Node, fn: () => Value): void {
  bind("text", idOf(node), () => {
    const s = toText(fn());
    if (node.nodeType === 3) {
      if (node.nodeValue !== s) node.nodeValue = s;
      return;
    }
    const only = node.firstChild;
    if (only !== null && only === node.lastChild && only.nodeType === 3) {
      if (only.nodeValue !== s) only.nodeValue = s;
    } else if (node.textContent !== s) node.textContent = s;
  });
}
