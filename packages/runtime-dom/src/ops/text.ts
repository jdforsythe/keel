import { bind } from "../internal/bind.ts";
import { idOf } from "../internal/idOf.ts";
import type { Value } from "../types/Value.ts";

/** A DOM node, or an array holding one at any depth. */
const holdsNode = (v: unknown): boolean =>
  (typeof v === "object" && v !== null && "nodeType" in v) || (Array.isArray(v) && v.some(holdsNode));

/**
 * The text a binding renders. A node, or an array holding one, renders nothing: elements reach the DOM only
 * as nodes, and the compiler reports what it can see as E1403 (rfc:0061). There is no dev channel for a
 * binding, so this stays silent.
 */
const toText = (v: unknown): string =>
  v === null || v === undefined || typeof v === "boolean" || holdsNode(v) ? "" : String(v);

/**
 * Bind the text of `node` to `fn`. A text node's data is set; an element's single text child is updated
 * in place (else its text content is replaced). Equal values do not touch the DOM. A node, or an array holding
 * one, renders as "" (rfc:0061).
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
