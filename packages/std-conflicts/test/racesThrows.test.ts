// std.conflicts: what a transaction function's throw does while `races` replays an order. A TypeError or RangeError
// (a reducer reading a state its author did not expect) fails that order; any other `Error` (a dependency's failure)
// makes that entry `unchecked` `threw` and the analysis goes on; a defect and a thrown value that is no `Error` pass on
// to the caller of `races`, unseen and unchanged. Nothing is swallowed and nothing waits. Seed 1337 (no generated input).
import { defect, isDefect, s } from "@keel/schema";
import { races as racesOf } from "@keel/std-conflicts";
import { store, transaction } from "@keel/store";
import { describe, expect, test } from "vitest";
import { root, snapshotAfter } from "./helpers.ts";

const races: typeof racesOf = (...args) => root(() => racesOf(...args));

const Items = s.object({ items: s.array(s.object({ id: s.string(), v: s.int() })) });
type Missing = "type" | "range" | "defect" | "string" | "error";

/** `x.items`: `add`, `bump` (which fails as `missing` says on an item no longer held) and `drop`. */
const itemStores = (missing: Missing) => () => () => {
  const items = store(Items, { items: [] }, { id: "x.items" });
  const add = transaction(items, "x.add", s.object({ id: s.string() }), (st, p) => ({
    items: [...st.items, { id: p.id, v: 0 }],
  }));
  // Each form throws before the closing `defect`, which the `defect` form reaches.
  const fail = (): never => {
    if (missing === "type") Reflect.apply(String.prototype.at, undefined, [0]);
    if (missing === "range") Reflect.apply(Array, undefined, [-1]);
    if (missing === "string" || missing === "error") {
      const thrown: unknown = missing === "string" ? "no item" : new Error("no item");
      Reflect.apply(
        () => {
          throw thrown;
        },
        undefined,
        [],
      );
    }
    return defect("no item to bump");
  };
  const bump = transaction(
    items,
    "x.bump",
    s.object({ id: s.string() }),
    (st, p) => {
      const at = st.items.find((i) => i.id === p.id) ?? fail();
      return { items: st.items.map((i) => (i === at ? { ...i, v: i.v + 1 } : i)) };
    },
    { concurrent: "rebase" },
  );
  const set = transaction(
    items,
    "x.set",
    s.object({ id: s.string(), v: s.int() }),
    (st, p) => ({ items: st.items.map((i) => (i.id === p.id ? { ...i, v: p.v } : i)) }),
    { concurrent: "rebase" },
  );
  const drop = transaction(
    items,
    "x.drop",
    s.object({ id: s.string() }),
    (st, p) => ({ items: st.items.filter((i) => i.id !== p.id) }),
    { concurrent: "rebase" },
  );
  return { items, add, bump, set, drop };
};

// Live: add a, bump a, then drop a from base 1. Replayed with the drop first, the bump finds no item.
const steps = [
  { name: "x.add", payload: { id: "a" } },
  { name: "x.bump", payload: { id: "a" } },
  { name: "x.drop", payload: { id: "a" }, base: 1 },
];
const caught = (f: () => unknown): unknown => {
  try {
    return f();
  } catch (e) {
    return { threw: e };
  }
};

describe("races over a transaction function that throws", () => {
  test.each(["type", "range"] as const)("a %s error fails that order: an invalid race", (missing) => {
    const snap = snapshotAfter(itemStores("type")(), steps);
    expect(races(snap, itemStores(missing)()).races.map((r) => r.kind)).toEqual(["invalid"]);
  });

  test("a defect passes on to the caller, as raised", () => {
    const snap = snapshotAfter(itemStores("type")(), steps);
    const out = caught(() => races(snap, itemStores("defect")()));
    expect(typeof out === "object" && out !== null && "threw" in out && isDefect(out.threw)).toBe(true);
  });

  test("a thrown string passes on to the caller unchanged", () => {
    const snap = snapshotAfter(itemStores("type")(), steps);
    const out = caught(() => races(snap, itemStores("string")()));
    expect(typeof out === "object" && out !== null && "threw" in out ? out.threw : out).toBe("no item");
  });

  // Live: add a, add b, set b 1, then set b 2 from base 2 (an order race), bump a, then drop a from base 4.
  const both = [
    { name: "x.add", payload: { id: "a" } },
    { name: "x.add", payload: { id: "b" } },
    { name: "x.set", payload: { id: "b", v: 1 } },
    { name: "x.set", payload: { id: "b", v: 2 }, base: 2 },
    { name: "x.bump", payload: { id: "a" } },
    { name: "x.drop", payload: { id: "a" }, base: 4 },
  ];

  test("an Error thrown by the transaction is unchecked threw for that entry, and the other entry's race stands", () => {
    const snap = snapshotAfter(itemStores("type")(), both);
    const found = races(snap, itemStores("error")());
    expect(found.races.map((r) => [r.entry.id, r.kind])).toEqual([[4, "order"]]);
    expect(found.unchecked).toEqual([{ store: "x.items", id: 6, reason: "threw" }]);
  });

  test("with a defect in place of the Error, races throws the defect", () => {
    const snap = snapshotAfter(itemStores("type")(), both);
    const out = caught(() => races(snap, itemStores("defect")()));
    expect(typeof out === "object" && out !== null && "threw" in out && isDefect(out.threw)).toBe(true);
  });
});
