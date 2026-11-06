import { computed, effect, scope } from "@keel/reactive";
import type { Unit } from "../internal/Unit.ts";
import { consumed } from "../internal/consumed.ts";
import { current } from "../internal/current.ts";
import { idOf } from "../internal/idOf.ts";
import { prepare } from "../internal/prepare.ts";
import { renderUnit } from "../internal/renderUnit.ts";
import { report } from "../internal/report.ts";
import { writesOf } from "../internal/writesOf.ts";

/**
 * `If`: render `then()` before `anchor` while `when()` is truthy, else `otherwise()` (or nothing).
 * A branch re-renders only when the truthiness flips; each branch lives in its own scope, created in the
 * op's `home` scope (`home.run`) and disposed when the branch is replaced.
 */
export function cond(anchor: Node, when: () => unknown, then: () => Node, otherwise?: () => Node): void {
  const parent = current("cond");
  const at = idOf(anchor);
  const { end, claim } = prepare(anchor);
  const truthy = computed(() => Boolean(when()));
  const home = scope(() => {});
  let unit: Unit | null = null;
  let hydrate = claim;
  effect(
    () => {
      unit?.dispose();
      unit = null;
      const h = hydrate;
      hydrate = null;
      let v: boolean;
      try {
        v = truthy.get();
      } catch (error) {
        report(parent, error, at);
        return;
      }
      const branch = v ? then : otherwise;
      if (branch === undefined) {
        if (h !== null) consumed(h);
        return;
      }
      unit = home.run(() =>
        renderUnit(parent, parent.catcher, end, branch, h, at, h === null ? undefined : () => consumed(h)),
      );
    },
    { writes: writesOf(parent) },
  );
}
