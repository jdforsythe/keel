// Seed 1337. `payloads` and the reactive registry (rfc:0070).
import { effect, scope, signal } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { store } from "../src/store.ts";
import { stores } from "../src/stores.ts";
import { transaction } from "../src/transaction.ts";

const Counter = s.object({ n: s.int() });

test("payloads maps each declared transaction name to its payload schema, schemas only", () => {
  scope(
    () => {
      const c = store(Counter, { n: 0 }, { id: "pl.c" });
      expect(c.payloads.size).toBe(0);
      const Add = s.object({ by: s.int() });
      transaction(c, "pl.add", Add, (st, p) => ({ n: st.n + p.by }));
      transaction(c, "pl.reset", s.object({}), () => ({ n: 0 }));
      expect([...c.payloads.keys()]).toEqual(["pl.add", "pl.reset"]);
      expect(c.payloads.get("pl.add")).toBe(Add);
      expect(c.payloads.get("pl.add")?.parse({ by: 2 }).ok).toBe(true);
      expect(c.payloads.get("pl.add")?.parse({ by: "x" }).ok).toBe(false);
    },
    { detached: true },
  ).dispose();
});

test("payloads parse every payload their transactions accept", () => {
  fc.assert(
    fc.property(fc.integer(), (by) => {
      const sc = scope(
        () => {
          const c = store(Counter, { n: 0 });
          transaction(c, "pp.add", s.object({ by: s.int() }), (st, p) => ({ n: st.n + p.by }));
          expect(c.payloads.get("pp.add")?.parse({ by }).ok).toBe(true);
        },
        { detached: true },
      );
      sc.dispose();
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("creating a store inside an effect does not throw E1201 and reruns stores() readers", () => {
  const seen: number[] = [];
  const outer = scope(
    () => {
      const on = signal(false);
      effect(() => void seen.push([...stores().keys()].filter((k) => k.startsWith("ie.")).length));
      effect(
        () => {
          if (on.get()) store(Counter, { n: 0 }, { id: "ie.x" });
        },
        { writes: [] },
      );
      on.set(true);
    },
    { detached: true },
  );
  expect(seen.at(-1)).toBe(1);
  outer.dispose();
});

test("a computation reading stores() while a store is created inside it is not invalidated mid-run", () => {
  const sc = scope(
    () => {
      effect(() => {
        stores();
        if (!stores().has("self.x")) store(Counter, { n: 0 }, { id: "self.x" });
      });
    },
    { detached: true },
  );
  expect(stores().has("self.x")).toBe(true);
  sc.dispose();
  expect(stores().has("self.x")).toBe(false);
});
