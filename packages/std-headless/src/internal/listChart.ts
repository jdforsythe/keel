import type { Ctx } from "@keel/ctx";
import { computed, signal } from "@keel/reactive";
import { instance } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import type { KeyInput } from "@keel/ui/aria";
import type { Option } from "../Option.ts";
import { optionsChart } from "../optionsChart.ts";
import type { ListState } from "./ListState.ts";
import { checkKeys } from "./checkKeys.ts";
import { stableRows } from "./stableRows.ts";

const PAUSE = 500;

/**
 * A list widget's interaction state: an `optionsChart` instance keyed by the widget `id`, the list (keys checked,
 * E2801), the active option and its part id `<id>.<part>.<key>`, and typeahead. The chart's `count` follows the list's
 * length: `open` carries it and every other event sends `items` first when it changed. The typeahead buffer lives
 * here, never in the chart.
 */
export function listChart<O extends Option>(
  id: string,
  part: string,
  options: () => readonly O[],
  ctx?: Ctx,
): ListState<O> {
  const c = instance(optionsChart, id);
  const list = computed(() => {
    const xs = options();
    checkKeys(
      id,
      xs.map((o) => o.key),
    );
    return xs;
  });
  // Checks the keys at render (E2801).
  list.get();
  const size = () => Math.min(list.get().length, 10_000);
  // The keys the chart's indexes refer to: the list as of the chart's last event. A widget signal, never in the chart.
  const known = signal<readonly string[]>(list.get().map((o) => o.key));
  /** The current index of the option the chart's `active` names in `known`, or -1 when its key is gone. */
  const remap = (at: number): number => {
    const key = known.get()[at];
    return key === undefined ? -1 : list.get().findIndex((o) => o.key === key);
  };
  const open = computed(() => c.store.get("state") === "open");
  const index = computed(() => remap(c.store.get("data").active));
  // Before an event: a changed list sends `items`, then `jump` to where the active key now sits (-1 when gone).
  const sync = () => {
    const keys = list.get().map((o) => o.key);
    const was = known.get();
    if (keys.length === was.length && keys.every((k, i) => k === was[i])) return;
    const at = index.get();
    if (c.store.get("data").count !== size()) tx(c.events.items, { count: size() });
    known.set(keys);
    if (open.get() && c.store.get("data").active !== at) tx(c.events.jump, { to: at });
  };
  const partId = (key: string) => `${id}.${part}.${key}`;
  const activeId = computed(() => {
    const o = list.get()[index.get()];
    return o === undefined ? "" : partId(o.key);
  });
  const jump = (to: number) => {
    sync();
    tx(c.events.jump, { to });
  };
  let buffer = "";
  let last = Number.NEGATIVE_INFINITY;
  return {
    list,
    rows: stableRows(
      () => list.get(),
      (o) => o.key,
    ),
    current: (key: string) => list.get().find((o) => o.key === key),
    open,
    index,
    activeId,
    partId,
    back: () => c.store.get("data").back,
    activeOption: (): O | undefined => list.get()[index.get()],
    indexOf: (key: string) => list.get().findIndex((o) => o.key === key),
    opened: (at: number) => {
      sync();
      if (!open.get()) tx(c.events.open, { count: size(), at: Math.min(at, 9999) });
    },
    close: (back: boolean) => {
      sync();
      if (open.get()) tx(c.events.close, { back });
    },
    choose: () => {
      sync();
      tx(c.events.choose, {});
    },
    move: (by: "next" | "prev" | "first" | "last", wrap: boolean) => {
      sync();
      tx(c.events.move, { by, wrap });
    },
    jump,
    /** A printable key without `mod` extends the buffer and jumps to the next option whose text starts with it. */
    typeahead: (k: KeyInput): boolean => {
      if ([...k.key].length !== 1 || k.mod) return false;
      const now = ctx?.clock.now();
      if (now === undefined || now - last >= PAUSE) buffer = "";
      last = now ?? last;
      buffer += k.key.toLocaleLowerCase();
      const xs = list.get();
      const from = index.get();
      for (let n = 1; n <= xs.length; n++) {
        const i = (from + n) % xs.length;
        if (xs[i]?.text.toLocaleLowerCase().startsWith(buffer) === true) {
          jump(i);
          break;
        }
      }
      return true;
    },
  };
}
