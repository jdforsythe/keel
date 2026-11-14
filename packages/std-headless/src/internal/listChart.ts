import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { instance } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import type { KeyInput } from "@keel/ui/aria";
import type { Option } from "../Option.ts";
import { optionsChart } from "../optionsChart.ts";
import { checkKeys } from "./checkKeys.ts";
import { untracked } from "./untracked.ts";

const PAUSE = 500;

/**
 * A list widget's interaction state: an `optionsChart` instance keyed by the widget `id`, the list (keys checked,
 * E2801), the active option and its part id `<id>.<part>.<key>`, and typeahead. The chart's `count` follows the list's
 * length: `open` carries it and every other event sends `items` first when it changed. The typeahead buffer lives
 * here, never in the chart.
 */
export function listChart<O extends Option>(id: string, part: string, options: () => readonly O[], ctx?: Ctx) {
  const c = instance(optionsChart, id);
  const list = computed(() => {
    const xs = options();
    checkKeys(
      id,
      xs.map((o) => o.key),
    );
    return xs;
  });
  // Checks the keys at render (E2801) without subscribing the enclosing render to the app's list.
  untracked(() => list.get());
  const size = () => Math.min(list.get().length, 10_000);
  const sync = () => {
    if (c.store.get("data").count !== size()) tx(c.events.items, { count: size() });
  };
  const open = computed(() => c.store.get("state") === "open");
  const index = computed(() => {
    const at = c.store.get("data").active;
    return at < list.get().length ? at : -1;
  });
  const partId = (o: O) => `${id}.${part}.${o.key}`;
  const activeId = computed(() => {
    const o = list.get()[index.get()];
    return o === undefined ? "" : partId(o);
  });
  const jump = (to: number) => {
    sync();
    tx(c.events.jump, { to });
  };
  let buffer = "";
  let last = Number.NEGATIVE_INFINITY;
  return {
    list,
    open,
    index,
    activeId,
    partId,
    back: () => c.store.get("data").back,
    activeOption: (): O | undefined => list.get()[index.get()],
    indexOf: (key: string) => list.get().findIndex((o) => o.key === key),
    opened: (at: number) => {
      if (!open.get()) tx(c.events.open, { count: size(), at: Math.min(at, 9999) });
    },
    close: (back: boolean) => {
      if (open.get()) tx(c.events.close, { back });
    },
    choose: () => tx(c.events.choose, {}),
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
