import { text } from "@keel/runtime-dom/ops";
import type { Child } from "../types/Child.ts";
import { isReadable } from "./isReadable.ts";

/**
 * Append `child` to an empty or claimed `parent`: text always becomes a text node; a signal/computed binds one
 * `text` op; a fragment's nodes go in one by one. A node already in its place (claimed at resume, rfc:0064) is
 * not moved, and new nodes go in before the next one, so the order is the order given.
 */
export function appendChildren(parent: Node, child: Child | undefined): void {
  let at = parent.firstChild;
  const put = (n: Node): void => {
    if (n === at) at = n.nextSibling;
    else parent.insertBefore(n, at);
  };
  const add = (c: Child | undefined): void => {
    if (c === undefined) return;
    if (typeof c === "string" || typeof c === "number") put(document.createTextNode(String(c)));
    else if (isReadable(c)) {
      const t = document.createTextNode("");
      put(t);
      text(t, () => String(c.get()));
    } else if (c instanceof Node) {
      if (c.nodeType === 11) for (const n of [...c.childNodes]) put(n);
      else put(c);
    } else for (const x of c) add(x);
  };
  add(child);
}
