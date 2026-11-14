// Spec: k.prove, Conformance "An invariant true in every reachable state but not inductive rejects E1716 with a state no transaction reaches."
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import { prove } from "@keel/testing/prove";
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

// Reachable from 0: 0 and 2. The invariant `n !== 1` holds in both, but state 3 satisfies it and steps to 1.
const ring = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.ring` });
  invariant(st, (state) => state.n !== 1);
  const step = transaction(st, `${id}.step`, s.object({}), (state) => ({
    n: state.n === 0 ? 2 : state.n === 2 ? 0 : state.n === 3 ? 1 : state.n,
  }));
  return { step };
};

describe("k.prove: an invariant true but not inductive", () => {
  it("the invariant holds in every state explore reaches, and 3 is not one of them", () => {
    const { step } = build(ring);
    const r = explore([step]);
    expect(r.complete).toBe(true);
    expect(r.states).toEqual([{ n: 0 }, { n: 2 }]);
  });

  it(
    "prove rejects E1716 with a state no transaction reaches",
    async () => {
      const { step } = build(ring);
      const e = await rejection(() => prove([step]));
      expect(codeOf(e)).toBe("E1716");
      const ns = valuesAt(jsonLine(e), "n");
      expect(ns).toContain(3);
      expect(ns).not.toContain(0);
      expect(ns).not.toContain(2);
    },
    LONG,
  );
});
