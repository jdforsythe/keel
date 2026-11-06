import { text } from "@keel/runtime-dom/ops";
import type { Child } from "../types/Child.ts";
import { isReadable } from "./isReadable.ts";

/** Append `child` to `parent`: text always becomes a text node; a signal/computed binds one `text` op. */
export function appendChildren(parent: Node, child: Child | undefined): void {
  if (child === undefined) return;
  if (typeof child === "string" || typeof child === "number") {
    parent.appendChild(document.createTextNode(String(child)));
  } else if (isReadable(child)) {
    const t = parent.appendChild(document.createTextNode(""));
    text(t, () => String(child.get()));
  } else if (child instanceof Node) {
    parent.appendChild(child);
  } else {
    for (const c of child) appendChildren(parent, c);
  }
}
