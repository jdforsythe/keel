// k.store Log limit (RFC 0054, backlog 0131): a store with `logLimit` L behaves as a history capped at L undoable
// steps: state, log length and `snapshot().initial` follow the capped model under any mix of commits, rejected
// payloads and undos; a snapshot restores to the same snapshot.
// Seed: 1337 (opts in kit.ts).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { store, transaction, tx } from "../src/index.ts";
import { trim } from "../src/internal/trim.ts";
import { type Counter, Counter as CounterSchema, type Op, initial, opArb, opts } from "./kit.ts";

function limited(limit: number) {
  const box: { kit?: ReturnType<typeof build> } = {};
  const build = () => {
    const c = store(CounterSchema, initial, { logLimit: limit });
    return {
      c,
      add: transaction(c, "counter.add", s.object({ by: s.int() }), (st, { by }) => ({ ...st, n: st.n + by })),
      tag: transaction(c, "counter.tag", s.object({ tag: s.string() }), (st, { tag }) => ({
        ...st,
        tags: [...st.tags, tag],
      })),
      reset: transaction(c, "counter.reset", s.object({}), () => ({ n: 0, tags: [] })),
    };
  };
  scope(() => {
    box.kit = build();
  });
  if (box.kit === undefined) throw new Error("scope body did not run");
  return box.kit;
}

/** The capped model: `hist[0]` is the base, every later item one undoable commit; at most `limit` of them. */
function cappedModel(ops: readonly Op[], limit: number): Counter[] {
  const hist: Counter[] = [initial];
  const push = (next: Counter) => {
    hist.push(next);
    if (hist.length > limit + 1) hist.shift();
  };
  for (const op of ops) {
    const top = hist[hist.length - 1] ?? initial;
    if (op.kind === "add") push({ ...top, n: top.n + op.by });
    else if (op.kind === "tag") push({ ...top, tags: [...top.tags, op.tag] });
    else if (op.kind === "reset") push(initial);
    else if (op.kind === "undo" && hist.length > 1) hist.pop();
  }
  return hist;
}

describe("logLimit (property)", () => {
  it("state, kept log and snapshot base follow the capped model; undo stops at the kept window", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), fc.array(opArb, { maxLength: 30 }), (limit, ops) => {
        const k = limited(limit);
        for (const op of ops) {
          if (op.kind === "add") tx(k.add, { by: op.by });
          else if (op.kind === "tag") tx(k.tag, { tag: op.tag });
          else if (op.kind === "reset") tx(k.reset, {});
          else if (op.kind === "undo") k.c.undo();
          else {
            const wire: unknown = { by: "x" };
            expect(tx(k.add, wire).ok).toBe(false);
          }
        }
        const hist = cappedModel(ops, limit);
        const snap = k.c.snapshot();
        expect(snap.state).toEqual(hist[hist.length - 1]);
        expect(snap.initial).toEqual(hist[0]);
        expect(k.c.log()).toHaveLength(hist.length - 1);
        const again = limited(limit);
        expect(again.c.restore(JSON.parse(JSON.stringify(snap))).ok).toBe(true);
        expect(again.c.snapshot()).toEqual(snap);
      }),
      opts,
    );
  });

  it("trim folds exactly the rows past the limit, oldest first, and returns the same array within it", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -9, max: 9 }), { maxLength: 12 }), fc.nat(14), (adds, limit) => {
        const rows = adds.map((by, i) => ({
          entry: { id: i + 1, name: "add", payload: { by }, at: i + 1 },
          apply: (n: number) => n * 2 + by,
        }));
        const out = trim(1, rows, limit);
        const over = Math.max(0, rows.length - limit);
        expect(out.rows).toEqual(rows.slice(over));
        if (over === 0) expect(out.rows).toBe(rows);
        expect(out.base).toBe(rows.slice(0, over).reduce((n, r) => r.apply(n), 1));
      }),
      opts,
    );
  });
});
