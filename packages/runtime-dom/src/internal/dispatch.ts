import { guard } from "./guard.ts";
import { handlers } from "./handlers.ts";

/**
 * Delegated dispatch: walk from `target` up to `root` (inclusive) and call each handler registered for
 * `event.type`, innermost first, until a handler calls `stopPropagation` or `stopImmediatePropagation`.
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
  try {
    for (let n: Node | null = target; n !== null && !stopped; n = n.parentNode) {
      if (n instanceof Element) {
        const h = handlers.get(n)?.get(event.type);
        if (h !== undefined && !h.owner.gone) guard(h.owner, h.at, () => h.fn(event));
      }
      if (n === root) break;
    }
  } finally {
    Reflect.deleteProperty(event, "stopPropagation");
    Reflect.deleteProperty(event, "stopImmediatePropagation");
  }
}
