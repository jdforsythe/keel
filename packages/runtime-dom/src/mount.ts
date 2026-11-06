import { scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";
import { createOwner } from "./internal/createOwner.ts";
import { createRoot } from "./internal/createRoot.ts";
import { disposeOwner } from "./internal/disposeOwner.ts";
import { withCx } from "./internal/withCx.ts";
import type { Component } from "./types/Component.ts";

/**
 * Render `component` client-side into `el` (generated entry only). The component takes no props: one that
 * requires props does not type-check; it is called with an empty props object. Returns `dispose`: removes the rendered
 * nodes, every root listener, and every binding and subscription of the tree. Idempotent.
 */
export function mount(component: Component<Readonly<Record<string, unknown>>>, el: Element): () => void {
  const root = createRoot(el);
  const owner = createOwner(null, root, null);
  let nodes: Node[] = [];
  let sc: Scope | null = null;
  const dispose = (): void => {
    disposeOwner(owner);
    sc?.dispose();
    root.dispose();
    for (const n of nodes) n.parentNode?.removeChild(n);
    nodes = [];
  };
  try {
    sc = scope(() => {
      const out = withCx(owner, null, () => component({}));
      nodes = out.nodeType === 11 ? [...out.childNodes] : [out];
      el.appendChild(out);
    });
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
