import { State } from "./internal/State.ts";
import { createNode } from "./internal/createNode.ts";
import { fail } from "./internal/fail.ts";
import { flush } from "./internal/flush.ts";
import { mark } from "./internal/mark.ts";
import { moduleOwned } from "./internal/moduleOwned.ts";
import { moduleWrites } from "./internal/moduleWrites.ts";
import { rt } from "./internal/rt.ts";
import { track } from "./internal/track.ts";
import type { Signal } from "./types/Signal.ts";

/**
 * A writable value. `set` with an `Object.is`-equal value is a no-op. Outside a batch each
 * changing `set` is its own commit; inside a computed, or an effect that did not declare it, it is E1201. On a signal
 * a module root owns it asks `moduleWrites` first (k.shared).
 */
export function signal<T>(initial: T): Signal<T> {
  const n = createNode("signal", undefined, []);
  let value = initial;
  const h: Signal<T> = {
    get: () => {
      track(n);
      return value;
    },
    set: (next) => {
      const r = rt.reaction;
      if (r && !r.writes.includes(h)) throw fail("E1201", "write to a signal not declared in this effect's writes");
      // Module state on a server (k.shared): asked before anything changes; no check is installed in a browser.
      if (moduleWrites.check !== null && moduleOwned(n)) moduleWrites.check(n.id, "signal");
      if (Object.is(next, value)) return;
      value = next;
      for (const o of n.observers) mark(o, State.Dirty);
      flush();
    },
  };
  return h;
}
