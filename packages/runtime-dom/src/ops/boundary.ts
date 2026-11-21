import { report } from "@keel/ctx/internal";
import { effect, scope, signal } from "@keel/reactive";
import type { Catcher } from "../internal/Catcher.ts";
import type { Unit } from "../internal/Unit.ts";
import { consumed } from "../internal/consumed.ts";
import { current } from "../internal/current.ts";
import { idOf } from "../internal/idOf.ts";
import { prepare } from "../internal/prepare.ts";
import { renderUnit } from "../internal/renderUnit.ts";
import { toCaught } from "../internal/toCaught.ts";
import { writesOf } from "../internal/writesOf.ts";
import type { CaughtError } from "../types/CaughtError.ts";

/**
 * `Boundary` (k.errors): render `children()` before `anchor`. A throw from their render, bindings, or
 * handlers (including rejected handler promises) disposes their scope at once and renders
 * `fallback(error, reset)` with `keel.unexpected` and `data.at`; `reset()` re-renders the children in a
 * fresh scope. Throws inside the fallback go to the enclosing Boundary. Children and fallback each render in
 * their own scope under the op's `home` scope (`home.run`). Each catch is reported to the ctx's observers as an
 * `error` event before the fallback renders (k.ctx Observers, rfc:0070). `root` (`mount` only) gives the `data.at` of a throw
 * at no element of its own: the app root's (k.errors).
 */
export function boundary(
  anchor: Node,
  children: () => Node,
  fallback: (error: CaughtError, reset: () => void) => Node,
  root?: { readonly at: string },
): void {
  const parent = current("boundary");
  const at = root?.at ?? idOf(anchor);
  const { end, claim } = prepare(anchor);
  let failed: CaughtError | null = null;
  const state = signal<{ readonly error: CaughtError | null }>({ error: null });
  const home = scope(() => {});
  let unit: Unit | null = null;
  const reset = (): void => {
    failed = null;
    state.set({ error: null });
  };
  const catcher: Catcher = {
    state,
    fail(error, where) {
      if (failed !== null) return;
      unit?.dispose();
      unit = null;
      failed = toCaught(error, where);
      report(parent.root.ctx, { kind: "error", error: failed });
      state.set({ error: failed });
    },
  };
  let hydrate = claim;
  effect(
    () => {
      const { error } = state.get();
      unit?.dispose();
      unit = null;
      const h = hydrate;
      hydrate = null;
      unit = home.run(() =>
        error === null
          ? renderUnit(parent, catcher, end, children, h, at, h === null ? undefined : () => consumed(h))
          : renderUnit(parent, parent.catcher, end, () => fallback(error, reset), null, at),
      );
    },
    { writes: writesOf(parent) },
  );
}
