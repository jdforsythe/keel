// Spec: k.prove, Rules "E1716 a counterexample: the state (or `initial`) and the payload, as JSON on the next line. The state may be unreachable; then the invariant is true but not inductive: strengthen it, or `explore`."
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
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

const queue = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const sub = transaction(st, `${id}.sub`, s.object({ by: s.int({ min: 1 }) }), (state, p) => ({ n: state.n - p.by }));
  return { sub };
};

describe("k.prove: E1716", () => {
  it(
    "E1716 puts the state and the payload as JSON on the line after the first",
    async () => {
      const { sub } = build(queue);
      const e = await rejection(() => prove([sub]));
      expect(codeOf(e)).toBe("E1716");
      expect(messageOf(e).split("\n").length).toBeGreaterThanOrEqual(2);
      const json = jsonLine(e);
      const ns = valuesAt(json, "n").filter((v): v is number => typeof v === "number");
      const bys = valuesAt(json, "by").filter((v): v is number => typeof v === "number");
      expect(ns).toHaveLength(1);
      expect(bys).toHaveLength(1);
      // the counterexample really breaks the invariant: n - by < 0
      expect((ns[0] ?? 0) - (bys[0] ?? 0)).toBeLessThan(0);
    },
    LONG,
  );
});
