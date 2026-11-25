// Spec: k.prove, clause "A store whose `initial` breaks an invariant rejects E1716 with that state and no payload."
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

const broken = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 1);
  const inc = transaction(st, `${id}.inc`, s.object({ by: s.int({ min: 1 }) }), (state, p) => ({ n: state.n + p.by }));
  return { inc };
};

describe("k.prove: initial", () => {
  it(
    "a store whose initial breaks an invariant rejects E1716 with that state and no payload",
    async () => {
      const { inc } = build(broken);
      const e = await rejection(() => prove([inc]));
      expect(codeOf(e)).toBe("E1716");
      const json = jsonLine(e);
      expect(valuesAt(json, "n")).toEqual([0]);
      expect(valuesAt(json, "by")).toEqual([]);
      expect(valuesAt(json, "payload")).toEqual([]);
    },
    LONG,
  );
});
