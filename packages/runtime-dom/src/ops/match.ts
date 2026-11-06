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
 * `Match`/`Case`: render `cases[on()[key]](value)` before `anchor`. The case re-renders only when the
 * tag changes; within a case, `value()` tracks the current union value. An unknown tag renders nothing.
 * Each case renders in its own scope under the op's `home` scope (`home.run`), disposed when the tag changes.
 */
export function match<U extends object>(
  anchor: Node,
  on: () => U,
  key: string,
  cases: Readonly<Record<string, (value: () => U) => Node>>,
): void {
  const parent = current("match");
  const at = idOf(anchor);
  const { end, claim } = prepare(anchor);
  const value = computed(on);
  const tag = computed(() => String(Reflect.get(value.get(), key)));
  const home = scope(() => {});
  let unit: Unit | null = null;
  let hydrate = claim;
  effect(
    () => {
      unit?.dispose();
      unit = null;
      const h = hydrate;
      hydrate = null;
      let t: string;
      try {
        t = tag.get();
      } catch (error) {
        report(parent, error, at);
        return;
      }
      const render = Object.hasOwn(cases, t) ? cases[t] : undefined;
      if (render === undefined) {
        if (h !== null) consumed(h);
        return;
      }
      unit = home.run(() =>
        renderUnit(
          parent,
          parent.catcher,
          end,
          () => render(value.get),
          h,
          at,
          h === null ? undefined : () => consumed(h),
        ),
      );
    },
    { writes: writesOf(parent) },
  );
}
