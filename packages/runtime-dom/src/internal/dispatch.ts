import { guard } from "./guard.ts";
import { handlers } from "./handlers.ts";
import { idOf } from "./idOf.ts";

/** Per event, the delegation root the last dispatch walked up to (nested mounts share bubbling events). */
const reached = new WeakMap<Event, Node>();

/**
 * Delegated dispatch: walk from `target` up to `root` (inclusive) and call each handler registered for
 * `event.type`, innermost first, until a handler calls `stopPropagation` or `stopImmediatePropagation`.
 * When an inner root (a mount or island nested in this root's tree) already dispatched the event, the walk
 * resumes above that inner root, so each element's handler runs at most once per event.
 */
export function dispatch(root: Element, event: Event, target: Node): void {
  let stopped = false;
  const native = Event.prototype;
  Object.defineProperty(event, "stopPropagation", {
    configurable: true,
    value: () => {
      stopped = true;
      native.stopPropagation.call(event);
    },
  });
  Object.defineProperty(event, "stopImmediatePropagation", {
    configurable: true,
    value: () => {
      stopped = true;
      native.stopImmediatePropagation.call(event);
    },
  });
  const inner = reached.get(event);
  const start = inner !== undefined && inner !== root && root.contains(inner) ? inner.parentNode : target;
  reached.set(event, root);
  try {
    for (let n: Node | null = start; n !== null && !stopped; n = n.parentNode) {
      if (n instanceof Element) {
        const h = handlers.get(n)?.get(event.type);
        // `data.at` of a throw: the id the handler was registered under, else the element's id when it throws.
        if (h !== undefined && !h.owner.gone) guard(h.owner, h.at || idOf(n), () => h.fn(event));
      }
      if (n === root) break;
    }
  } finally {
    Reflect.deleteProperty(event, "stopPropagation");
    Reflect.deleteProperty(event, "stopImmediatePropagation");
  }
}
