import { parts, text } from "@keel/runtime-dom/ops";
import type { Child } from "../types/Child.ts";
import { bound } from "./bound.ts";
import { isReadable } from "./isReadable.ts";

/**
 * Append `child` to an empty or claimed `parent`: text always becomes a text node; a signal/computed binds one
 * `text` op and marks `parent` bound; a fragment's nodes go in one by one. A node already in its place (claimed at
 * resume) is not moved, a server region and its anchor, which their op claimed, are passed over, and new nodes go in before the next one, so the
 * order is the order given.
 */
export function appendChildren(parent: Element, child: Child | undefined): void {
  let at = parent.firstChild;
  const put = (n: Node): void => {
    // A server region and the op anchor after it stay where they are: the op claimed them.
    for (let depth = 0; at !== null && at !== n && (depth > 0 || (at.nodeType === 8 && at.nodeValue === "[")); ) {
      if (at.nodeType === 8) depth += at.nodeValue === "[" ? 1 : at.nodeValue === "]" ? -1 : 0;
      at = at.nextSibling;
      if (depth === 0) at = at?.nextSibling ?? null;
    }
    if (n === at) at = n.nextSibling;
    else parent.insertBefore(n, at);
  };
  const add = (c: Child | undefined): void => {
    if (c === undefined) return;
    if (typeof c === "string" || typeof c === "number") put(document.createTextNode(String(c)));
    else if (isReadable(c)) {
      bound(parent);
      const t = document.createTextNode("");
      put(t);
      text(t, () => String(c.get()));
    } else if (c instanceof Node) {
      // Content `frag` claimed is in place: its texts and elements are passed over, its ops' regions and anchors
      // (comments already in `parent`) with them.
      if (c.nodeType !== 11) put(c);
      else for (const n of parts(c) ?? [...c.childNodes]) if (n.parentNode !== parent || n.nodeType !== 8) put(n);
    } else for (const x of c) add(x);
  };
  add(child);
}
