import { scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";
import { createOwner } from "./internal/createOwner.ts";
import { createRoot } from "./internal/createRoot.ts";
import { disposeOwner } from "./internal/disposeOwner.ts";
import { rootFallback } from "./internal/rootFallback.ts";
import { withCx } from "./internal/withCx.ts";
import { boundary } from "./ops/boundary.ts";
import type { Component } from "./types/Component.ts";

/**
 * Render `component` client-side at the end of `el` (generated entry only). The component takes no props:
 * one that requires props does not type-check; it is called with an empty props object. The root has a
 * default Boundary (k.errors) whose fallback shows the error in `<pre data-k-error>`. Returns `dispose`:
 * removes the rendered nodes, every root listener, and every binding and subscription. Idempotent.
 */
export function mount(component: Component<Readonly<Record<string, unknown>>>, el: Element): () => void {
  const root = createRoot(el);
  const owner = createOwner(null, root, null);
  const before = el.lastChild;
  const anchor = el.appendChild(el.ownerDocument.createComment(""));
  let sc: Scope | null = null;
  const dispose = (): void => {
    disposeOwner(owner);
    sc?.dispose();
    root.dispose();
    if (anchor.parentNode !== el) return;
    for (let n = before === null ? el.firstChild : before.nextSibling; n !== null; ) {
      const next = n === anchor ? null : n.nextSibling;
      el.removeChild(n);
      n = next;
    }
  };
  try {
    sc = scope(() => {
      withCx(owner, null, () => boundary(anchor, () => component({}), rootFallback));
    });
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
