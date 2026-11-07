// Properties for @keel/store over generated transaction sequences. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { tx } from "../src/index.ts";
import { type Op, makeCounter, model, opArb, opts } from "./kit.ts";

// An off-schema payload reaches tx only as `unknown` (wire data); typed call sites reject it at compile time.
const offSchema: unknown = { by: "not an int" };

function apply(k: ReturnType<typeof makeCounter>, op: Op): void {
  if (op.kind === "add") tx(k.add, { by: op.by });
  else if (op.kind === "tag") tx(k.tag, { tag: op.tag });
  else if (op.kind === "reset") tx(k.reset, {});
  else if (op.kind === "undo") k.c.undo();
  else tx(k.add, offSchema);
}

describe("@keel/store properties", () => {
  it("state and log length match the pure model under interleaved tx, invalid payloads and undo", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), (ops) => {
        const k = makeCounter();
        for (const op of ops) apply(k, op);
        const hist = model(ops);
        expect(k.c.snapshot().state).toEqual(hist[hist.length - 1]);
        expect(k.c.log().length).toBe(hist.length - 1);
      }),
      opts,
    );
  });

  it("replay determinism: replaying a log twice from fresh stores gives equal state and log", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), (ops) => {
        const src = makeCounter();
        for (const op of ops) apply(src, op);
        const runs = [makeCounter(), makeCounter()].map((k) => {
          const byName = new Map([k.add, k.tag, k.reset].map((t) => [t.name, t]));
          for (const e of src.c.log()) {
            const t = byName.get(e.name);
            if (t === undefined) throw new Error(`unknown ${e.name}`);
            expect(tx(t, e.payload).ok).toBe(true);
          }
          return k.c.snapshot();
        });
        expect(runs[0]).toEqual(runs[1]);
        expect(runs[0]?.state).toEqual(src.c.snapshot().state);
      }),
      opts,
    );
  });

  it("undo is the inverse of tx: undoing every entry walks the model history backwards", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), (ops) => {
        const k = makeCounter();
        for (const op of ops) apply(k, op);
        const hist = model(ops);
        for (let i = hist.length - 1; i > 0; i--) {
          expect(k.c.snapshot().state).toEqual(hist[i]);
          expect(k.c.undo()).toBe(true);
        }
        expect(k.c.snapshot().state).toEqual(hist[0]);
        expect(k.c.undo()).toBe(false);
      }),
      opts,
    );
  });

  it("undo after restore matches undo in the source store", () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 30 }), (ops) => {
        const src = makeCounter();
        for (const op of ops) apply(src, op);
        const dst = makeCounter();
        expect(dst.c.restore(JSON.parse(JSON.stringify(src.c.snapshot()))).ok).toBe(true);
        expect(dst.c.undo()).toBe(src.c.undo());
        expect(dst.c.snapshot()).toEqual(src.c.snapshot());
      }),
      opts,
    );
  });

  it("log ids stay unique across undo and restore; default-clock at stays non-decreasing", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), fc.array(opArb, { maxLength: 10 }), (ops, more) => {
        const src = makeCounter();
        for (const op of ops) apply(src, op);
        const dst = makeCounter();
        dst.c.restore(JSON.parse(JSON.stringify(src.c.snapshot())));
        for (const op of more) apply(dst, op);
        const log = dst.c.log();
        expect(new Set(log.map((e) => e.id)).size).toBe(log.length);
        const ats = log.map((e) => e.at);
        expect([...ats].sort((a, b) => a - b)).toEqual(ats);
      }),
      opts,
    );
  });
});
