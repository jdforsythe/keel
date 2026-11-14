// Spec: k.prove, Conformance "`rlimit: 1` rejects E1717 where the default proves."
// Spec: k.prove, Rules "E1717 no verdict within `rlimit` (default 10,000,000 Z3 resource units, a count rather than time, so a verdict repeats)."
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
  return { inc, dec };
};

describe("k.prove: E1717", () => {
  it(
    "rlimit: 1 rejects E1717 where the default proves",
    async () => {
      const { inc, dec } = build(counter);
      expect(await rejection(() => prove([inc, dec]))).toBeUndefined();
      expect(codeOf(await rejection(() => prove([inc, dec], { rlimit: 1 })))).toBe("E1717");
    },
    LONG,
  );

  it(
    "E1717 repeats: a count rather than time gives the same rejection on every run",
    async () => {
      const { inc, dec } = build(counter);
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(1), async (rlimit) => {
          const a = await rejection(() => prove([inc, dec], { rlimit }));
          const b = await rejection(() => prove([inc, dec], { rlimit }));
          expect(codeOf(a)).toBe("E1717");
          expect(messageOf(b)).toBe(messageOf(a));
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    LONG,
  );
});
