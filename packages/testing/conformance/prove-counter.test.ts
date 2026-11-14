// Spec: k.prove, Conformance "A store `{ n: s.int({ min: 0 }) }` with invariant `n >= 0`, `inc` (`n + 1`) and `dec` (`n > 0 ? n - 1 : n`) proves; with `dec` as `n - 1` it rejects E1716 with state `{ n: 0 }`."
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LONG = 120_000;

let seq = 0;
/** Build a fixture inside a scope (E1203) under ids unique to this call. */
const build = <R>(mk: (id: string) => R): R => {
  seq += 1;
  const id = `pv${seq}`;
  let out: { value: R } | undefined;
  scope(() => {
    out = { value: mk(id) };
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);
const messageOf = (e: unknown): string => (isRecord(e) && typeof e.message === "string" ? e.message : String(e));
/** What the promise rejected with, or undefined when it resolved. */
const rejection = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e ?? new Error("rejected with a falsy value");
  }
};
/** The JSON on the line after the first line of the message. */
const jsonLine = (e: unknown): unknown => {
  const line = messageOf(e).split("\n")[1];
  if (line === undefined) throw new Error("fixture: no line after the first line of the message");
  return JSON.parse(line);
};
/** Every value stored under `key` anywhere in `value`. */
const valuesAt = (value: unknown, key: string): unknown[] => {
  if (Array.isArray(value)) return value.flatMap((v) => valuesAt(v, key));
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => (k === key ? [v, ...valuesAt(v, key)] : valuesAt(v, key)));
};

const counter = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const none = s.object({});
  const inc = transaction(st, `${id}.inc`, none, (state) => ({ n: state.n + 1 }));
  const dec = transaction(st, `${id}.dec`, none, (state) => ({ n: state.n > 0 ? state.n - 1 : state.n }));
  const bad = transaction(st, `${id}.bad`, none, (state) => ({ n: state.n - 1 }));
  return { inc, dec, bad };
};
// `n - by` for by = 1..4, each on its own store
const lower = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const none = s.object({});
  return [
    transaction(st, `${id}.by1`, none, (state) => ({ n: state.n - 1 })),
    transaction(st, `${id}.by2`, none, (state) => ({ n: state.n - 2 })),
    transaction(st, `${id}.by3`, none, (state) => ({ n: state.n - 3 })),
    transaction(st, `${id}.by4`, none, (state) => ({ n: state.n - 4 })),
  ];
};

describe("k.prove: counter", () => {
  it(
    "a store { n: s.int({ min: 0 }) } with invariant n >= 0, inc and dec proves",
    async () => {
      const { inc, dec } = build(counter);
      expect(await rejection(() => prove([inc, dec]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "with dec as n - 1 the proof rejects E1716 with state { n: 0 }",
    async () => {
      const { inc, bad } = build(counter);
      const e = await rejection(() => prove([inc, bad]));
      expect(codeOf(e)).toBe("E1716");
      expect(valuesAt(jsonLine(e), "n")).toContain(0);
    },
    LONG,
  );

  it(
    "n - by rejects E1716 for every by in 1..4, and the state's n is below by",
    async () => {
      const txs = build(lower);
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (i) => {
          const t = txs[i];
          if (t === undefined) throw new Error("fixture: no transaction");
          const e = await rejection(() => prove([t]));
          expect(codeOf(e)).toBe("E1716");
          const ns = valuesAt(jsonLine(e), "n").filter((v): v is number => typeof v === "number");
          expect(ns.length).toBeGreaterThan(0);
          expect(ns.some((n) => n >= 0 && n < i + 1)).toBe(true);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    LONG,
  );
});
