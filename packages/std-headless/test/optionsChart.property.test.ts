import { scope } from "@keel/reactive";
import { instance } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { optionsChart } from "../src/optionsChart.ts";

type Ev =
  | { e: "open"; count: number; at: number }
  | { e: "close"; back: boolean }
  | { e: "choose" }
  | { e: "move"; by: "next" | "prev" | "first" | "last"; wrap: boolean }
  | { e: "jump"; to: number }
  | { e: "items"; count: number };

const ev: fc.Arbitrary<Ev> = fc.oneof(
  fc.record({
    e: fc.constant("open" as const),
    count: fc.integer({ min: 0, max: 5 }),
    at: fc.integer({ min: -1, max: 7 }),
  }),
  fc.record({ e: fc.constant("close" as const), back: fc.boolean() }),
  fc.record({ e: fc.constant("choose" as const) }),
  fc.record({
    e: fc.constant("move" as const),
    by: fc.constantFrom("next" as const, "prev" as const, "first" as const, "last" as const),
    wrap: fc.boolean(),
  }),
  fc.record({ e: fc.constant("jump" as const), to: fc.integer({ min: -1, max: 7 }) }),
  fc.record({ e: fc.constant("items" as const), count: fc.integer({ min: 0, max: 5 }) }),
);

/** A naive model: the list as an array of indexes, the active one as a position in it or none. */
type Naive = { open: boolean; list: number[]; active: number | null; back: boolean };

const step = (m: Naive, x: Ev): Naive => {
  const n = m.list.length;
  if (x.e === "items") {
    const list = Array.from({ length: x.count }, (_, i) => i);
    return {
      ...m,
      list,
      active: m.active === null ? null : list.length === 0 ? null : Math.min(m.active, x.count - 1),
    };
  }
  if (x.e === "open") {
    if (m.open) return m;
    const list = Array.from({ length: x.count }, (_, i) => i);
    return { open: true, list, active: list.includes(x.at) ? x.at : null, back: false };
  }
  if (!m.open) return m;
  if (x.e === "close") return { ...m, open: false, active: null, back: x.back };
  if (x.e === "choose") return { ...m, open: false, active: null, back: true };
  if (x.e === "jump") return x.to === -1 ? { ...m, active: null } : m.list.includes(x.to) ? { ...m, active: x.to } : m;
  if (n === 0) return m;
  if (x.by === "first") return { ...m, active: 0 };
  if (x.by === "last") return { ...m, active: n - 1 };
  const a = m.active;
  if (x.by === "next") return { ...m, active: a === null ? 0 : a + 1 < n ? a + 1 : x.wrap ? 0 : a };
  return { ...m, active: a === null ? n - 1 : a > 0 ? a - 1 : x.wrap ? n - 1 : a };
};

let n = 0;
test("optionsChart agrees with a naive list model under generated event sequences", () => {
  fc.assert(
    fc.property(fc.array(ev, { maxLength: 20 }), (evs) => {
      n += 1;
      const sc = scope(
        () => {
          const i = instance(optionsChart, `p${n}`);
          let m: Naive = { open: false, list: [], active: null, back: false };
          for (const x of evs) {
            if (x.e === "open") void tx(i.events.open, { count: x.count, at: x.at });
            else if (x.e === "close") void tx(i.events.close, { back: x.back });
            else if (x.e === "choose") void tx(i.events.choose, {});
            else if (x.e === "move") void tx(i.events.move, { by: x.by, wrap: x.wrap });
            else if (x.e === "jump") void tx(i.events.jump, { to: x.to });
            else void tx(i.events.items, { count: x.count });
            m = step(m, x);
            const v = i.store.snapshot().state;
            expect(v.state).toBe(m.open ? "open" : "closed");
            expect(v.data.active).toBe(m.active ?? -1);
            expect(v.data.back).toBe(m.back);
            expect(v.data.count).toBe(m.list.length);
            expect(v.data.active === -1 || v.data.active < v.data.count).toBe(true);
          }
        },
        { detached: true },
      );
      sc.dispose();
    }),
    { seed: 1337, numRuns: 300 },
  );
});
