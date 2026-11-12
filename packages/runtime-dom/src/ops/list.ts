import { computed, effect, scope } from "@keel/reactive";
import type { Computed } from "@keel/reactive";
import { reaction } from "@keel/reactive/internal";
import type { Unit } from "../internal/Unit.ts";
import { consumed } from "../internal/consumed.ts";
import { current } from "../internal/current.ts";
import { idOf } from "../internal/idOf.ts";
import { prepare } from "../internal/prepare.ts";
import { renderUnit } from "../internal/renderUnit.ts";
import { report } from "../internal/report.ts";
import { writesOf } from "../internal/writesOf.ts";

type Row = { unit: Unit | null; rendered: boolean };

/**
 * `For`: one row per distinct `key(item)` of `each()`, in order, before `anchor`. Rows are keyed: when
 * the order changes rows move (node identity kept); a row is created only for a new key and disposed
 * when its key leaves, so a row whose key stays keeps its nodes (and focus, selection and input state) whatever
 * its item object. `item()`/`index()` give the row's current item and position: a binding reading them updates
 * in place; a read at the top level of the row body is the value at render and never re-renders the row (other
 * top-level reads still do, as in any unit). First key wins.
 * Rows live in the op's own `home` scope (`home.run`), so reruns of the reconcile effect never dispose them.
 * `empty`, when given, renders (in its own scope) while `each()` has no rows and is removed when rows arrive.
 */
export function list<T>(
  anchor: Node,
  each: () => readonly T[],
  key: (item: T) => unknown,
  render: (item: () => T, index: () => number) => Node,
  empty?: () => Node,
): void {
  const parent = current("list");
  const at = idOf(anchor);
  const { end, claim } = prepare(anchor);
  type Slot = { readonly item: T; readonly index: number };
  const byKey = computed(() => {
    const m = new Map<unknown, Slot>();
    each().forEach((item, index) => {
      const k = key(item);
      if (!m.has(k)) m.set(k, { item, index });
    });
    return m;
  });
  const rows = new Map<unknown, Row>();
  const home = scope(() => {});
  let order: unknown[] = [];
  let pending = 0;
  let hydrate = claim;
  let emptyUnit: Unit | null = null;
  // Rows' nodes are the contiguous run before `end`. One forward pass from its first node: a node already in place
  // stays, any other is moved before it, so new rows (rendered before `end`) move into place and do not displace
  // the rows they precede.
  const place = (): void => {
    const p = end.parentNode;
    if (pending > 0 || p === null) return;
    const want = order.flatMap((k) => rows.get(k)?.unit?.nodes() ?? []);
    let cursor: Node | null = end;
    for (let i = 0; i < want.length && cursor !== null; i++) cursor = cursor.previousSibling;
    cursor ??= p.firstChild;
    for (const n of want) {
      if (n === cursor) cursor = n.nextSibling;
      else p.insertBefore(n, cursor);
    }
  };
  effect(
    () => {
      let m: Map<unknown, Slot>;
      try {
        m = byKey.get();
      } catch (error) {
        report(parent, error, at);
        return;
      }
      order = [...m.keys()];
      for (const [k, row] of rows) {
        if (m.has(k)) continue;
        if (!row.rendered) pending--;
        row.unit?.dispose();
        rows.delete(k);
      }
      const h = hydrate;
      hydrate = null;
      if (m.size > 0 && emptyUnit !== null) {
        emptyUnit.dispose();
        emptyUnit = null;
      }
      if (m.size === 0 && empty !== undefined) {
        if (emptyUnit === null) {
          emptyUnit = home.run(() =>
            renderUnit(parent, parent.catcher, end, empty, h, at, h === null ? undefined : () => consumed(h)),
          );
        }
      } else if (h !== null && m.size === 0) consumed(h);
      for (const [k, first] of m) {
        if (rows.has(k)) continue;
        const row: Row = { unit: null, rendered: false };
        rows.set(k, row);
        pending++;
        const row$ = (): Unit => {
          let item = first.item;
          let index = first.index;
          return renderUnit(
            parent,
            parent.catcher,
            end,
            () => {
              const top = reaction();
              // Separate computeds: a move (index change) never invalidates readers of item(), and vice versa.
              const itemC = computed(() => {
                item = byKey.get().get(k)?.item ?? item;
                return item;
              });
              const indexC = computed(() => {
                index = byKey.get().get(k)?.index ?? index;
                return index;
              });
              // Read from the row body itself (not from a binding or computed inside it): untracked.
              const read = <V>(c: Computed<V>): V => (reaction() === top ? home.run(() => c.get()) : c.get());
              return render(
                () => read(itemC),
                () => read(indexC),
              );
            },
            h,
            at,
            () => {
              if (!row.rendered) {
                row.rendered = true;
                pending--;
                if (pending === 0 && h !== null) consumed(h);
              }
              place();
            },
          );
        };
        row.unit = home.run(row$);
      }
      place();
    },
    { writes: writesOf(parent) },
  );
}
