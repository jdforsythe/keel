import { type Capability, type Ctx, register } from "@keel/ctx";
import { type Signal, scope, signal } from "@keel/reactive";

/** The per-ctx state behind `appearance(ctx)`: whether the ctx is a sim one, and a version each pick bumps. */
type State = { readonly sim: boolean; readonly version: Signal<number> };

/** A version signal that lives as long as its ctx, in a detached scope of its own: a capability is built on first access, wherever that is. */
const version = (): Signal<number> => {
  let made: Signal<number> | undefined;
  scope(
    () => {
      made = signal(0);
    },
    { detached: true },
  );
  if (made === undefined) throw new Error("appearance: scope ran no setup");
  return made;
};

const IMPLS: Capability<State> = {
  real: () => ({ sim: false, version: version() }),
  shell: () => ({ sim: false, version: version() }),
  sim: () => ({ sim: true, version: version() }),
};
let accessor: ((ctx: Ctx) => State) | undefined;

/**
 * The `appearance` capability's state for `ctx`, registered on first use so that an app that never reads a pick
 * carries no capability for it.
 */
export function appearanceState(ctx: Ctx): State {
  accessor ??= register("appearance", IMPLS);
  return accessor(ctx);
}
