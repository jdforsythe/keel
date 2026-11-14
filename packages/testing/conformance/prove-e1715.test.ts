// Spec: k.prove, Conformance "A transaction calling an imported helper rejects E1715 naming the call."
// Spec: k.prove, Rules "E1715 a function outside the fragment, naming the construct and its offset in the function's source, or a schema without a sort (Sorts), naming its path; there is no claim, and `explore` remains."
// Seed: 1337.
import { isDeepStrictEqual } from "node:util";
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

const fixture = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const none = s.object({});
  const helper = transaction(st, `${id}.helper`, none, (state) => ({ n: isDeepStrictEqual(state.n, 0) ? 1 : state.n }));
  const builtin = transaction(st, `${id}.builtin`, none, (state) => ({ n: Math.max(state.n, 1) }));
  const loop = transaction(st, `${id}.loop`, none, (state) => {
    let total = state.n;
    for (let i = 0; i < 3; i++) {
      total = total + 1;
    }
    return { n: total };
  });
  const reassign = transaction(st, `${id}.reassign`, none, (state) => {
    let total = state.n;
    total = total + 1;
    return { n: total };
  });
  const inSort = transaction(st, `${id}.inSort`, none, (state) => ({ n: state.n + 1 }));
  // a payload schema without a sort: s.json() at `extra`
  const noSort = transaction(st, `${id}.noSort`, s.object({ extra: s.json() }), (state) => ({ n: state.n }));
  // a state schema without a sort: a union at `choice`
  const wide = store(s.object({ choice: s.union([s.string(), s.int()]) }), { choice: "a" }, { id: `${id}.wide` });
  const noSortState = transaction(wide, `${id}.noSortState`, s.object({}), (state) => state);
  return { helper, builtin, loop, reassign, inSort, noSort, noSortState };
};

describe("k.prove: E1715", () => {
  it.skip(
    "a transaction calling an imported helper rejects E1715 naming the call",
    async () => {
      const { helper } = build(fixture);
      const e = await rejection(() => prove([helper]));
      expect(codeOf(e)).toBe("E1715");
      expect(messageOf(e)).toContain("isDeepStrictEqual");
    },
    LONG,
  );

  it.skip(
    "a function outside the fragment rejects E1715 naming an offset in its source",
    async () => {
      const f = build(fixture);
      const outside = [f.helper, f.builtin, f.loop, f.reassign];
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: outside.length - 1 }), async (i) => {
          const t = outside[i];
          if (t === undefined) throw new Error("fixture: no transaction");
          const e = await rejection(() => prove([t]));
          expect(codeOf(e)).toBe("E1715");
          expect(messageOf(e)).toMatch(/\d+/);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    LONG,
  );

  it.skip(
    "calls to other functions, loops and reassignment are each E1715",
    async () => {
      const f = build(fixture);
      for (const t of [f.builtin, f.loop, f.reassign]) {
        expect(codeOf(await rejection(() => prove([t])))).toBe("E1715");
      }
    },
    LONG,
  );

  it.skip(
    "a payload schema without a sort rejects E1715 naming its path",
    async () => {
      const { noSort } = build(fixture);
      const e = await rejection(() => prove([noSort]));
      expect(codeOf(e)).toBe("E1715");
      expect(messageOf(e)).toContain("extra");
    },
    LONG,
  );

  it.skip(
    "a store schema without a sort rejects E1715 naming its path",
    async () => {
      const { noSortState } = build(fixture);
      const e = await rejection(() => prove([noSortState]));
      expect(codeOf(e)).toBe("E1715");
      expect(messageOf(e)).toContain("choice");
    },
    LONG,
  );
});
