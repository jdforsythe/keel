// Seed 1337. store(): the logLimit message, a null options value, the reject conflict text, tracked reads, uses()
// accumulating and the restore error path of a bad `initial`.
import { effect, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { store, transaction, tx } from "../src/index.ts";
import { coreKey } from "../src/internal/coreKey.ts";

const State = s.object({ n: s.int() });
const build = (id: string, concurrent: "reject" | "rebase" = "rebase") => {
  const c = store(State, { n: 0 }, { id });
  const add = transaction(c, `${id}.add`, s.object({ by: s.int() }), (st, p) => ({ n: st.n + p.by }), { concurrent });
  return { c, add };
};

describe("store", () => {
  it("names the store and the value in the logLimit error", () => {
    scope(
      () => {
        expect(() => store(State, { n: 0 }, { id: "se.lim", logLimit: -1 })).toThrow(
          "store se.lim: logLimit -1 is not a non-negative integer",
        );
        expect(() => store(State, { n: 0 }, { id: "se.lim", logLimit: 1.5 })).toThrow(
          "store se.lim: logLimit 1.5 is not a non-negative integer",
        );
      },
      { detached: true },
    ).dispose();
  });

  it("treats a null options value as no options", () => {
    scope(
      () => {
        const { c, add } = build("se.null");
        const out = add[coreKey]({ by: 2 }, null);
        expect(out.ok).toBe(true);
        expect(c.get("n")).toBe(2);
      },
      { detached: true },
    ).dispose();
  });

  it("words a rejected stale base with the transaction, both heads and the store", () => {
    scope(
      () => {
        const { c, add } = build("se.rej", "reject");
        tx(add, { by: 1 });
        const out = tx(add, { by: 1 }, { base: 0 });
        expect(out.ok).toBe(false);
        if (!out.ok) {
          expect(out.error.message).toBe("se.rej.add: base 0 is not head 1 of store se.rej");
          expect(out.error.data).toEqual({ store: "se.rej", transaction: "se.rej.add", base: 0, head: 1 });
        }
        expect(c.get("n")).toBe(1);
      },
      { detached: true },
    ).dispose();
  });

  it("tracks head() and snapshot() as reactive reads", () => {
    const sc = scope(
      () => {
        const { c, add } = build("se.track");
        const heads: number[] = [];
        const states: number[] = [];
        effect(() => {
          heads.push(c.head());
        });
        effect(() => {
          states.push(c.snapshot().head);
        });
        tx(add, { by: 1 });
        tx(add, { by: 1 });
        c.undo();
        expect(heads).toEqual([0, 1, 2, 3]);
        expect(states).toEqual([0, 1, 2, 3]);
      },
      { detached: true },
    );
    sc.dispose();
  });

  it("accumulates uses() declarations made in one scope", () => {
    scope(
      () => {
        const { c, add } = build("se.uses");
        const other = transaction(c, "se.uses.other", s.object({}), (st) => st);
        const third = transaction(c, "se.uses.third", s.object({}), (st) => st);
        c.uses([add]);
        c.uses([other]);
        expect(tx(add, { by: 1 }).ok).toBe(true);
        expect(tx(other, {}).ok).toBe(true);
        const refused = tx(third, {});
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.error.code).toBe("store.undeclared");
      },
      { detached: true },
    ).dispose();
  });

  it("restore reports a bad initial at the initial path, even when absent", () => {
    scope(
      () => {
        const { c } = build("se.init");
        const bad = c.restore({ state: { n: 1 }, log: [], initial: { n: "x" } });
        expect(bad.ok).toBe(false);
        if (!bad.ok) expect(bad.error.data.issues[0]?.path[0]).toBe("initial");
        const missing = c.restore({ state: { n: 1 }, log: [] });
        expect(missing.ok).toBe(false);
        if (!missing.ok) expect(missing.error.data.issues[0]?.path[0]).toBe("initial");
        expect(c.get("n")).toBe(0);
      },
      { detached: true },
    ).dispose();
  });
});
