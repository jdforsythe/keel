// k.leave Snapshots: with a read tap set, a store notes its id when it is created, looked up through `stores().get`
// or read (`get`, `select`, `snapshot`, `log`, `head`); a write or a store never touched is not noted, and with no
// tap set nothing is.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { storeReads } from "../src/internal/storeReads.ts";
import { store } from "../src/store.ts";
import { stores } from "../src/stores.ts";
import { transaction } from "../src/transaction.ts";
import { tx } from "../src/tx.ts";

const Count = s.object({ n: s.int() });
const READS = ["get", "select", "snapshot", "log", "head"] as const;
type Read = (typeof READS)[number];

let runs = 0;
afterEach(() => {
  storeReads.note = null;
});

function read(st: ReturnType<typeof store<{ n: number }>>, how: Read): void {
  if (how === "get") st.get("n");
  else if (how === "select") st.select((x) => x.n);
  else if (how === "snapshot") st.snapshot();
  else if (how === "log") st.log();
  else st.head();
}

describe("storeReads", () => {
  it("notes a store at creation, and nothing with no tap set", () => {
    const seen: string[] = [];
    scope(
      () => {
        store(Count, { n: 0 }, { id: "t.before" });
        storeReads.note = (id) => seen.push(id);
        store(Count, { n: 0 }, { id: "t.made" });
      },
      { detached: true },
    );
    expect(seen).toEqual(["t.made"]);
  });

  it("property: each read and each `stores().get` notes exactly that store, a write notes nothing", () => {
    fc.assert(
      fc.property(fc.constantFrom(...READS), fc.boolean(), (how, lookup) => {
        const k = ++runs;
        scope(
          () => {
            const a = store(Count, { n: 1 }, { id: `t.a${k}` });
            const b = store(Count, { n: 2 }, { id: `t.b${k}` });
            const set = transaction(b, `t.set${k}`, Count, (_st, p) => p);
            const seen = new Set<string>();
            storeReads.note = (id) => seen.add(id);
            tx(set, { n: 3 });
            expect(seen.size).toBe(0);
            if (lookup) expect(stores().get(`t.a${k}`)).toBe(a);
            else read(a, how);
            expect([...seen]).toEqual([`t.a${k}`]);
            storeReads.note = null;
            expect(stores().get(`t.b${k}`)).toBe(b);
          },
          { detached: true },
        );
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
