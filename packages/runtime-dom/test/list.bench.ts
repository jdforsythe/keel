// @vitest-environment happy-dom
// Keyed-list row cost (rfc:0014, runtime PLAN D27). Not a CI gate: run with
// `pnpm --filter @keel/runtime-dom exec vitest bench --run test/list.bench.ts`.
import { bench, describe } from "vitest";
import { mount } from "../src/index.ts";
import { clone, list, template, text } from "../src/ops/index.ts";
import { rootSignal } from "./support.ts";

type Item = { readonly id: number; readonly v: number };

const UL = template("<ul><!----></ul>");
const LI = template("<li></li>");
const N = 1000;
const OPTS = { time: 2000, warmupIterations: 20 };

const rows = (n: number, v = 0): Item[] => Array.from({ length: n }, (_, id) => ({ id, v }));

/** A mounted list of `N` rows over a root signal; each row binds `id:v@index`. */
function setup(): { items: ReturnType<typeof rootSignal<readonly Item[]>> } {
  const items = rootSignal<readonly Item[]>(rows(N));
  mount(() => {
    const ul = clone(UL);
    const anchor = ul.lastChild;
    if (anchor === null) throw new Error("no anchor");
    list(
      anchor,
      () => items.get(),
      (i) => i.id,
      (item, index) => {
        const li = clone(LI);
        text(li, () => `${item().id}:${item().v}@${index()}`);
        return li;
      },
    );
    return ul;
  }, document.createElement("div"));
  return { items };
}

describe(`list of ${N} rows`, () => {
  const move = setup();
  bench(
    "move: swap rows 1 and N-2",
    () => {
      const xs = [...move.items.get()];
      const a = xs[1];
      const b = xs[N - 2];
      if (a === undefined || b === undefined) return;
      xs[1] = b;
      xs[N - 2] = a;
      move.items.set(xs);
    },
    OPTS,
  );

  const reverse = setup();
  bench(
    "move: reverse all rows",
    () => {
      reverse.items.set([...reverse.items.get()].reverse());
    },
    OPTS,
  );

  const update = setup();
  let v = 0;
  bench(
    "update: new item for every 10th row",
    () => {
      v++;
      update.items.set(update.items.get().map((x) => (x.id % 10 === 0 ? { id: x.id, v } : x)));
    },
    OPTS,
  );

  const grow = setup();
  bench(
    "add 10 rows then remove them (two commits)",
    () => {
      const base = grow.items.get();
      grow.items.set([...base, ...rows(10).map((x) => ({ id: N + x.id, v: 0 }))]);
      grow.items.set(base);
    },
    OPTS,
  );

  bench(
    "mount and dispose",
    () => {
      const items = rootSignal<readonly Item[]>(rows(N));
      const dispose = mount(() => {
        const ul = clone(UL);
        const anchor = ul.lastChild;
        if (anchor === null) throw new Error("no anchor");
        list(
          anchor,
          () => items.get(),
          (i) => i.id,
          (item) => {
            const li = clone(LI);
            text(li, () => String(item().id));
            return li;
          },
        );
        return ul;
      }, document.createElement("div"));
      dispose();
    },
    OPTS,
  );
});
