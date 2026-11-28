import type { HostCode } from "./types/HostCode.ts";
import type { HostOut } from "./types/HostOut.ts";

/**
 * Host element code (k.host-code): `mount(node, value, out)` returns the code's own state, `update(state, value, prev)`
 * gets the latest value and the one the last call got, by reference, and `dispose(state)` runs once. Without `update`
 * a change of value draws nothing; without `dispose` nothing runs at teardown.
 */
export function hostCode<I, E = never, S = undefined>(def: {
  readonly mount: (node: HTMLElement, value: I, out: HostOut<E>) => S;
  readonly update?: (state: S, value: I, prev: I) => void;
  readonly dispose?: (state: S) => void;
}): HostCode<I, E> {
  return {
    start(node, value, out) {
      const state = def.mount(node, value, out);
      return {
        update: (next, prev) => def.update?.(state, next, prev),
        dispose: () => def.dispose?.(state),
      };
    },
  };
}
