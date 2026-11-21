import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { flush } from "./flush.ts";
import { mark } from "./mark.ts";
import { track } from "./track.ts";

/**
 * A value-less, ownerless signal for kernel registries (k.store `stores()`, rfc:0070): `read` subscribes the running
 * computation; `fire` reruns its readers. Unlike a signal write, `fire` is allowed inside any effect (a registry
 * changes as a side effect of creating or disposing a store during a render), skips a reader that is running, and is
 * not listed by `inspect`.
 */
export function pulse(): { read(): void; fire(): void } {
  const n: Node = {
    id: 0,
    kind: "signal",
    fn: undefined,
    sources: [],
    observers: [],
    state: State.Clean,
    owner: null,
    owned: [],
    writes: [],
    gone: false,
  };
  return {
    read: () => track(n),
    fire: () => {
      for (const o of [...n.observers]) if (o.state !== State.Running) mark(o, State.Dirty);
      flush();
    },
  };
}
