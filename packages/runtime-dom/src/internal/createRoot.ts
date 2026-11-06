import type { Root } from "./Root.ts";
import { dispatch } from "./dispatch.ts";

/** A delegation root on `el` (or detached until `attach`): at most one listener per event type. */
export function createRoot(el: Element | null): Root {
  let target = el;
  const types = new Map<string, (e: Event) => void>();
  return {
    listen(type) {
      if (types.has(type)) return;
      const l = (e: Event): void => {
        if (target !== null && e.target instanceof Node) dispatch(target, e, e.target);
      };
      types.set(type, l);
      target?.addEventListener(type, l);
    },
    attach(next) {
      for (const [t, l] of types) {
        target?.removeEventListener(t, l);
        next.addEventListener(t, l);
      }
      target = next;
    },
    dispose() {
      for (const [t, l] of types) target?.removeEventListener(t, l);
      types.clear();
    },
  };
}
