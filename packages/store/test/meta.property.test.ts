// Properties for RFC 0028 (log entry meta, undoWhere) over generated transaction sequences. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type LogEntry, type LogMeta, tx } from "../src/index.ts";
import { type Op, makeCounter, model, opArb, opts } from "./kit.ts";

type Kit = ReturnType<typeof makeCounter>;

const callerArb = fc.constantFrom("a", "b");
const metaArb: fc.Arbitrary<LogMeta | undefined> = fc.option(
  fc.oneof(
    fc.record({ caller: callerArb }),
    fc.dictionary(
      fc.constantFrom("caller", "n", "tags"),
      fc.oneof(fc.string({ maxLength: 4 }), fc.integer(), fc.boolean(), fc.constant(null), fc.array(fc.integer())),
    ),
  ),
  { nil: undefined },
);
const stepArb = fc.tuple(opArb, metaArb);

const offSchema: unknown = { by: "not an int" };

function apply(k: Kit, [op, meta]: [Op, LogMeta | undefined]): void {
  const o = meta === undefined ? undefined : { meta };
  if (op.kind === "add") tx(k.add, { by: op.by }, o);
  else if (op.kind === "tag") tx(k.tag, { tag: op.tag }, o);
  else if (op.kind === "reset") tx(k.reset, {}, o);
  else if (op.kind === "undo") k.c.undo();
  else tx(k.add, offSchema, o);
}

const plain = (log: readonly LogEntry[]) => log.map((e) => [e.id, e.name, e.payload, e.at]);

describe("@keel/store meta properties", () => {
  it("meta never changes state, and each entry carries exactly the meta its tx was given", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 30 }), (steps) => {
        const k = makeCounter();
        const expected: (LogMeta | undefined)[] = [];
        for (const step of steps) {
          apply(k, step);
          const [op, meta] = step;
          if (op.kind === "undo") expected.pop();
          else if (op.kind !== "bad") expected.push(meta);
        }
        const hist = model(steps.map(([op]) => op));
        expect(k.c.snapshot().state).toEqual(hist[hist.length - 1]);
        expect(k.c.log().map((e) => e.meta)).toEqual(expected);
        expect(k.c.log().map((e) => Object.hasOwn(e, "meta"))).toEqual(expected.map((m) => m !== undefined));
      }),
      opts,
    );
  });

  it("snapshot() is snapshot({ meta: true }) without meta; each restores its own log through JSON", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 30 }), (steps) => {
        const src = makeCounter();
        for (const step of steps) apply(src, step);
        const full = src.c.snapshot({ meta: true });
        const bare = src.c.snapshot();
        expect(bare.state).toEqual(full.state);
        expect(plain(bare.log)).toEqual(plain(full.log));
        expect(bare.log.some((e) => Object.hasOwn(e, "meta"))).toBe(false);
        const withMeta = makeCounter();
        expect(withMeta.c.restore(JSON.parse(JSON.stringify(full))).ok).toBe(true);
        expect(withMeta.c.log()).toEqual(src.c.log());
        const without = makeCounter();
        expect(without.c.restore(JSON.parse(JSON.stringify(bare))).ok).toBe(true);
        expect(without.c.log()).toEqual(bare.log);
      }),
      opts,
    );
  });

  it("undoWhere(pred) is undo() when pred holds for the latest entry and a no-op otherwise", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 30 }), callerArb, (steps, who) => {
        const k = makeCounter();
        const twin = makeCounter();
        for (const step of steps) {
          apply(k, step);
          apply(twin, step);
        }
        const pred = (e: LogEntry): boolean => e.meta?.caller === who;
        const last = k.c.log().at(-1);
        const matches = last !== undefined && pred(last);
        const before = JSON.stringify(k.c.snapshot({ meta: true }));
        expect(k.c.undoWhere(pred)).toBe(matches);
        if (matches) {
          expect(twin.c.undo()).toBe(true);
          expect(k.c.snapshot({ meta: true })).toEqual(twin.c.snapshot({ meta: true }));
        } else expect(JSON.stringify(k.c.snapshot({ meta: true }))).toBe(before);
      }),
      opts,
    );
  });
});
