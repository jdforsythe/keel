// Spec: k.prove, clause "Appending `p` to an array under `!a.some(x => x.id === p.id)` proves `new Set(a.map(x => x.id)).size === a.length`; without the guard it rejects E1716 with a state holding `p.id`."
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
  scope(
    () => {
      out = { value: mk(id) };
    },
    { detached: true },
  );
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

const board = (id: string) => {
  const Item = s.object({ id: s.string() });
  const st = store(s.object({ items: s.array(Item) }), { items: [] }, { id: `${id}.items` });
  invariant(st, (state) => new Set(state.items.map((x) => x.id)).size === state.items.length);
  const guarded = transaction(st, `${id}.guarded`, Item, (state, p) =>
    !state.items.some((x) => x.id === p.id) ? { items: [...state.items, p] } : state,
  );
  const unguarded = transaction(st, `${id}.unguarded`, Item, (state, p) => ({ items: [...state.items, p] }));
  return { guarded, unguarded };
};

describe("k.prove: unique ids", () => {
  it(
    "appending p under !a.some(x => x.id === p.id) proves the ids are distinct",
    async () => {
      const { guarded } = build(board);
      expect(await rejection(() => prove([guarded]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "without the guard the proof rejects E1716 with a state holding p.id",
    async () => {
      const { unguarded } = build(board);
      const e = await rejection(() => prove([unguarded]));
      expect(codeOf(e)).toBe("E1716");
      const ids = valuesAt(jsonLine(e), "id");
      // the payload's id and the id of an item of the state are the same value
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(ids.some((v, i) => ids.indexOf(v) !== i)).toBe(true);
    },
    LONG,
  );

  it(
    "proving twice returns equal verdicts for either transaction",
    async () => {
      const { guarded, unguarded } = build(board);
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (useGuard) => {
          const t = useGuard ? guarded : unguarded;
          const a = await rejection(() => prove([t]));
          const b = await rejection(() => prove([t]));
          expect(codeOf(a)).toBe(useGuard ? undefined : "E1716");
          expect(codeOf(b)).toBe(codeOf(a));
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    LONG,
  );
});
