// Spec: std.headless, Conformance "`optionsChart`, `openChart` and `toastChart` hold the transitions in the table"
// Seed: 1337.
// Assumptions: `instance(chart, key)` is imported from `@keel/std-statecharts`; `choose` takes `{}`; `expire` from `showing` goes to `gone`
// (the table gives only "`expire` (in `showing`)"); `open` while open, and events a state does not list, leave the state unchanged;
// `close` and `choose` keep `count`; `count` 0 with `move` keeps `active` at -1; `jump` with `to` at or above `count` is not asserted.
import { instance } from "@keel/std-statecharts";
import { openChart, optionsChart, toastChart } from "@keel/std-headless";
import { tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, inScope, nextKey, optionsView } from "./fixtures.ts";

const by = ["next", "prev", "first", "last"] as const;
type Step =
  | { e: "open"; count: number; at: number }
  | { e: "close"; back: boolean }
  | { e: "choose" }
  | { e: "move"; by: (typeof by)[number]; wrap: boolean }
  | { e: "jump"; to: number }
  | { e: "items"; count: number };

const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    e: fc.constant("open" as const),
    count: fc.integer({ min: 1, max: 6 }),
    at: fc.integer({ min: -1, max: 8 }),
  }),
  fc.record({ e: fc.constant("close" as const), back: fc.boolean() }),
  fc.record({ e: fc.constant("choose" as const) }),
  fc.record({ e: fc.constant("move" as const), by: fc.constantFrom(...by), wrap: fc.boolean() }),
  fc.record({ e: fc.constant("jump" as const), to: fc.integer({ min: -1, max: 5 }) }),
  fc.record({ e: fc.constant("items" as const), count: fc.integer({ min: 1, max: 6 }) }),
);

// The table, as a reference model: open at `count` >= 1 only.
type Model = { open: boolean; active: number; count: number; back: boolean };
const next = (m: Model, st: Step): Model => {
  if (st.e === "open") {
    if (m.open) return m;
    return { open: true, count: st.count, active: st.at < st.count ? st.at : -1, back: false };
  }
  if (st.e === "close") return m.open ? { ...m, open: false, active: -1, back: st.back } : m;
  if (st.e === "choose") return m.open ? { ...m, open: false, active: -1, back: true } : m;
  if (st.e === "items") return { ...m, count: st.count, active: Math.min(m.active, st.count - 1) };
  if (!m.open) return m;
  if (st.e === "jump") return st.to < m.count ? { ...m, active: st.to } : m;
  const a = m.active;
  const last = m.count - 1;
  if (st.by === "first") return { ...m, active: 0 };
  if (st.by === "last") return { ...m, active: last };
  if (st.by === "next") return { ...m, active: a === -1 ? 0 : a < last ? a + 1 : st.wrap ? 0 : a };
  return { ...m, active: a === -1 ? last : a > 0 ? a - 1 : st.wrap ? last : a };
};

describe("std.headless: optionsChart transitions", () => {
  test("`optionsChart` holds the transitions in the table: `open` sets `active` to `at` when below `count`, else -1, and `back` false", async () => {
    const i = inScope(() => instance(optionsChart, nextKey("o")));
    expect(optionsView(i.store.snapshot().state)).toEqual({ state: "closed", active: -1, count: 0, back: false });
    await tx(i.events.open, { count: 3, at: 1 });
    expect(optionsView(i.store.snapshot().state)).toEqual({ state: "open", active: 1, count: 3, back: false });
    const j = inScope(() => instance(optionsChart, nextKey("o")));
    await tx(j.events.open, { count: 3, at: 5 });
    expect(optionsView(j.store.snapshot().state)?.active).toBe(-1);
  });

  test("`optionsChart`: `close { back }` and `choose` go to `closed` with `active` -1; `choose` sets `back` true", async () => {
    for (const back of [false, true]) {
      const i = inScope(() => instance(optionsChart, nextKey("o")));
      await tx(i.events.open, { count: 3, at: 2 });
      await tx(i.events.close, { back });
      const v = optionsView(i.store.snapshot().state);
      expect([v?.state, v?.active, v?.back]).toEqual(["closed", -1, back]);
    }
    const c = inScope(() => instance(optionsChart, nextKey("o")));
    await tx(c.events.open, { count: 3, at: 2 });
    await tx(c.events.choose, {});
    const v = optionsView(c.store.snapshot().state);
    expect([v?.state, v?.active, v?.back]).toEqual(["closed", -1, true]);
  });

  test("`optionsChart`: `move` `next` from -1 is 0, `prev` from -1 is `count - 1`; past an end it wraps when `wrap`, else stays", async () => {
    const at = async (count: number, start: number, dir: "next" | "prev", wrap: boolean) => {
      const i = inScope(() => instance(optionsChart, nextKey("o")));
      await tx(i.events.open, { count, at: start });
      await tx(i.events.move, { by: dir, wrap });
      return optionsView(i.store.snapshot().state)?.active;
    };
    expect(await at(3, -1, "next", false)).toBe(0);
    expect(await at(3, -1, "prev", false)).toBe(2);
    expect(await at(3, 2, "next", true)).toBe(0);
    expect(await at(3, 2, "next", false)).toBe(2);
    expect(await at(3, 0, "prev", true)).toBe(2);
    expect(await at(3, 0, "prev", false)).toBe(0);
    const i = inScope(() => instance(optionsChart, nextKey("o")));
    await tx(i.events.open, { count: 4, at: 1 });
    await tx(i.events.move, { by: "last", wrap: false });
    expect(optionsView(i.store.snapshot().state)?.active).toBe(3);
    await tx(i.events.move, { by: "first", wrap: false });
    expect(optionsView(i.store.snapshot().state)?.active).toBe(0);
  });

  test("`optionsChart`: `jump { to }` in open sets `active` to `to` when below `count`; `items { count }` clamps `active` to `count - 1`", async () => {
    const i = inScope(() => instance(optionsChart, nextKey("o")));
    await tx(i.events.open, { count: 5, at: 0 });
    await tx(i.events.jump, { to: 3 });
    expect(optionsView(i.store.snapshot().state)?.active).toBe(3);
    await tx(i.events.items, { count: 2 });
    const v = optionsView(i.store.snapshot().state);
    expect([v?.state, v?.active, v?.count]).toEqual(["open", 1, 2]);
    await tx(i.events.items, { count: 0 });
    expect(optionsView(i.store.snapshot().state)?.active).toBe(-1);
  });

  test("`optionsChart` follows the table for any event sequence (property against a model of the table)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(step, { maxLength: 14 }), async (steps) => {
        const i = inScope(() => instance(optionsChart, nextKey("o")));
        let m: Model = { open: false, active: -1, count: 0, back: false };
        for (const st of steps) {
          m = next(m, st);
          if (st.e === "open") await tx(i.events.open, { count: st.count, at: st.at });
          else if (st.e === "close") await tx(i.events.close, { back: st.back });
          else if (st.e === "choose") await tx(i.events.choose, {});
          else if (st.e === "move") await tx(i.events.move, { by: st.by, wrap: st.wrap });
          else if (st.e === "jump") await tx(i.events.jump, { to: st.to });
          else await tx(i.events.items, { count: st.count });
          const v = optionsView(i.store.snapshot().state);
          expect(v?.state).toBe(m.open ? "open" : "closed");
          expect(v?.active).toBe(m.active);
          expect(v?.back).toBe(m.back);
          if (m.open) expect(v?.count).toBe(m.count);
        }
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});

describe("std.headless: openChart and toastChart transitions", () => {
  test("`openChart` starts `closed`; `open` goes to `open`, `close` to `closed`, `toggle` flips (property over toggle counts)", async () => {
    const i = inScope(() => instance(openChart, nextKey("p")));
    expect(i.store.snapshot().state.state).toBe("closed");
    await tx(i.events.open, {});
    expect(i.store.snapshot().state.state).toBe("open");
    await tx(i.events.close, {});
    expect(i.store.snapshot().state.state).toBe("closed");
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 9 }), async (n) => {
        const j = inScope(() => instance(openChart, nextKey("p")));
        for (let k = 0; k < n; k++) await tx(j.events.toggle, {});
        expect(j.store.snapshot().state.state).toBe(n % 2 === 1 ? "open" : "closed");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`toastChart` starts `showing`; `pause` and `resume` move between `showing` and `paused`; `expire` in `showing` and `dismiss` go to `gone`", async () => {
    const i = inScope(() => instance(toastChart, nextKey("t")));
    expect(i.store.snapshot().state.state).toBe("showing");
    await tx(i.events.pause, {});
    expect(i.store.snapshot().state.state).toBe("paused");
    await tx(i.events.expire, {});
    expect(i.store.snapshot().state.state).toBe("paused");
    await tx(i.events.resume, {});
    expect(i.store.snapshot().state.state).toBe("showing");
    await tx(i.events.expire, {});
    expect(i.store.snapshot().state.state).toBe("gone");
    const j = inScope(() => instance(toastChart, nextKey("t")));
    await tx(j.events.dismiss, {});
    expect(j.store.snapshot().state.state).toBe("gone");
    const k = inScope(() => instance(toastChart, nextKey("t")));
    await tx(k.events.pause, {});
    await tx(k.events.dismiss, {});
    expect(k.store.snapshot().state.state).toBe("gone");
  });

  test("`toastChart`: `gone` is final and no event leaves it", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("pause" as const, "resume" as const, "expire" as const, "dismiss" as const), {
          maxLength: 6,
        }),
        async (evs) => {
          const i = inScope(() => instance(toastChart, nextKey("t")));
          await tx(i.events.dismiss, {});
          for (const e of evs) await tx(i.events[e], {});
          expect(i.store.snapshot().state.state).toBe("gone");
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});
