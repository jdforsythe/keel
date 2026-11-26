// A keyed write costs the same however large `keyLimit` is: the store looks a key up and adds it without copying
// or scanning the remembered keys (k.sync Write key). Seed-free: the writes are a fixed sequence.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { fixedTime } from "@keel/tooling/test-time";
import { expect, test } from "vitest";
import { store, transaction, tx } from "../src/index.ts";

const Count = s.object({ n: s.int() });
const Add = s.object({ by: s.int() });
const WRITES = 40_000;

function make(keyLimit: number) {
  const box: { kit?: ReturnType<typeof build> } = {};
  const build = () => {
    const c = store(Count, { n: 0 }, { keyLimit, logLimit: 0 });
    const add = transaction(c, "count.add", Add, (st, { by }) => ({ n: st.n + by }));
    return { c, add };
  };
  const sc = scope(() => {
    box.kit = build();
  });
  if (box.kit === undefined) throw new Error("scope body did not run");
  return { ...box.kit, dispose: sc.dispose };
}

// The assertions are on the result; the timeout is only a generous safety net against a quadratic cost.
test(
  `${WRITES} keyed writes under keyLimit 1,000,000 each commit once, retries commit nothing`,
  { timeout: fixedTime(30_000) },
  () => {
    const k = make(1_000_000);
    for (let i = 0; i < WRITES; i++) tx(k.add, { by: 1 }, { key: `w${i}` });
    for (let i = 0; i < WRITES; i += 997) tx(k.add, { by: 1 }, { key: `w${i}` });
    expect(k.c.get("n")).toBe(WRITES);
    const keys = k.c.snapshot().keys;
    expect(keys.length).toBe(WRITES);
    expect(keys[0]).toEqual({ name: "count.add", key: "w0" });
    expect(keys.at(-1)).toEqual({ name: "count.add", key: `w${WRITES - 1}` });
    k.dispose();
  },
);

test("past keyLimit the oldest key is forgotten and commits again; a key restored twice is held once", () => {
  const k = make(3);
  for (const key of ["a", "b", "c", "d"]) tx(k.add, { by: 1 }, { key });
  expect(k.c.snapshot().keys.map((x) => x.key)).toEqual(["b", "c", "d"]);
  tx(k.add, { by: 1 }, { key: "a" });
  tx(k.add, { by: 1 }, { key: "d" });
  expect(k.c.get("n")).toBe(5);
  const snap = k.c.snapshot();
  const key = (x: string) => ({ name: "count.add", key: x });
  expect(k.c.restore({ ...snap, keys: [key("c"), key("c"), key("d")] }).ok).toBe(true);
  tx(k.add, { by: 1 }, { key: "x" });
  expect(k.c.snapshot().keys.map((x) => x.key)).toEqual(["c", "d", "x"]);
  // `c` was kept twice; dropping its older copy leaves it held.
  tx(k.add, { by: 1 }, { key: "c" });
  expect(k.c.get("n")).toBe(6);
  k.dispose();
});

test(
  "writes far past keyLimit keep the latest window in order, and an evicted key commits again",
  { timeout: fixedTime(30_000) },
  () => {
    const limit = 50_000;
    const writes = 150_000;
    const k = make(limit);
    for (let i = 0; i < writes; i++) tx(k.add, { by: 1 }, { key: `w${i}` });
    expect(k.c.get("n")).toBe(writes);
    const keys = k.c.snapshot().keys;
    expect(keys.length).toBe(limit);
    expect(keys[0]).toEqual({ name: "count.add", key: `w${writes - limit}` });
    expect(keys.at(-1)).toEqual({ name: "count.add", key: `w${writes - 1}` });
    tx(k.add, { by: 1 }, { key: `w${writes - 1}` });
    expect(k.c.get("n")).toBe(writes);
    tx(k.add, { by: 1 }, { key: "w0" });
    expect(k.c.get("n")).toBe(writes + 1);
    k.dispose();
  },
);
