import { bind } from "../internal/bind.ts";
import { cx } from "../internal/cx.ts";
import { eachItem } from "../internal/eachItem.ts";
import { idOf } from "../internal/idOf.ts";
import { serverMode } from "../internal/serverMode.ts";
import type { Value } from "../types/Value.ts";

/**
 * Bind the text of `node` to `fn`. A text node's data is set; an element's single text child is updated
 * in place (else its text content is replaced). Equal values do not touch the DOM. A node, an array holding one, or a
 * function renders `''` (a function's source is never written; k.place): in `'dev'` mode the binding writes one
 * `console.warn` E1406 line, and a server render sets `serverMode.nothing`.
 */
export function text(node: Node, fn: () => Value): void {
  const id = idOf(node);
  let warn = cx.owner?.root.dev === true;
  bind("text", id, () => {
    const v: unknown = fn();
    let nothing = typeof v === "function";
    eachItem(v, (x) => {
      nothing ||= typeof x !== "string";
    });
    if (nothing) {
      serverMode.nothing ||= serverMode.on;
      if (warn) console.warn(`E1406 ${id} renders nothing`);
      warn = false;
    }
    const s = nothing || v === null || v === undefined || typeof v === "boolean" ? "" : String(v);
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
