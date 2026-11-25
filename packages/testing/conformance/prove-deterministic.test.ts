// Spec: k.prove, clause "Two runs give byte-equal verdicts and counterexamples."
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

// `n - k` for k = 0..3: k = 0 proves, the others have a counterexample
const family = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const none = s.object({});
  return [
    transaction(st, `${id}.k0`, none, (state) => ({ n: state.n - 0 })),
    transaction(st, `${id}.k1`, none, (state) => ({ n: state.n - 1 })),
    transaction(st, `${id}.k2`, none, (state) => ({ n: state.n - 2 })),
    transaction(st, `${id}.k3`, none, (state) => ({ n: state.n - 3 })),
  ];
};

const unbounded = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  return transaction(st, `${id}.inc`, s.object({}), (state) => ({ n: state.n + 1 }));
};

const outcome = async (run: () => Promise<unknown>) => {
  try {
    return { result: JSON.stringify(await run()) };
  } catch (e) {
    return { code: codeOf(e), message: messageOf(e), data: isRecord(e) ? JSON.stringify(e.data) : undefined };
  }
};

describe("k.prove: two runs", () => {
  it(
    "two runs over each transaction return byte-equal verdicts and counterexamples",
    async () => {
      const txs = build(family);
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (k) => {
          const t = txs[k];
          if (t === undefined) throw new Error("fixture: no transaction");
          const first = await outcome(() => prove([t]));
          const second = await outcome(() => prove([t]));
          expect(second).toEqual(first);
          expect(JSON.stringify(second)).toBe(JSON.stringify(first));
          if (k === 0) expect("result" in first).toBe(true);
          else expect(first).toHaveProperty("code", "E1716");
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    LONG,
  );
});

describe("k.prove: two runs of the safe-range counterexample", () => {
  it(
    "two runs over the unbounded inc return byte-equal counterexamples",
    async () => {
      const inc = build(unbounded);
      const first = await outcome(() => prove([inc]));
      const second = await outcome(() => prove([inc]));
      expect(first).toHaveProperty("code", "E1716");
      expect(second).toEqual(first);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    LONG,
  );
});
