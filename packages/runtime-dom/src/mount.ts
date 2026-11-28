import { owner as running, scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";
import { createOwner } from "./internal/createOwner.ts";
import { createRoot } from "./internal/createRoot.ts";
import { disposeOwner } from "./internal/disposeOwner.ts";
import { rootFallback } from "./internal/rootFallback.ts";
import { showRevealed } from "./internal/showRevealed.ts";
import { stampOf } from "./internal/stampOf.ts";
import { withCx } from "./internal/withCx.ts";
import { boundary } from "./ops/boundary.ts";
import type { Component } from "./types/Component.ts";
import type { MountOptions } from "./types/MountOptions.ts";

/**
 * Render `component` client-side at the end of `el` (generated entry only). The component takes no props:
 * one that requires props does not type-check; it is called with an empty props object and
 * `options.ctx` (k.ctx, required). `options.onError`
 * is called with each error the root Boundary catches, in addition to the fallback rendering. The root has a
 * default Boundary (k.errors) whose fallback is `<pre data-k-error>` holding `keel.unexpected`, or with
 * `options.mode` `"dev"` the error's message. Returns `dispose`:
 * removes the rendered nodes, every root listener, and every binding and subscription. Idempotent.
 */
export function mount(component: Component, el: Element, options: MountOptions): () => void {
  const root = createRoot(el, options.ctx, options.mode, options.artifacts);
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
    sc = scope(
      () => {
        withCx(owner, null, () =>
          boundary(
            anchor,
            () => component({}, options.ctx),
            (error) => {
              const fallback = rootFallback(error, options.mode);
              options.onError?.(error);
              return fallback;
            },
            // A throw at no element of its own (the root component's effect, computed or render): the stamp at the
            // root's place, as for a resumed island (k.errors).
            { at: stampOf(el) },
          ),
        );
      },
      // A root of its own only where none runs (an entry point); under a scope it nests (a request's, k.store).
      { detached: running() === undefined },
    );
  } catch (error) {
    dispose();
    throw error;
  } finally {
    showRevealed();
  }
  return dispose;
}
