// k.prove, Rules "E1716 a counterexample: the state (or `initial`) and the payload, as JSON on the next line. The state may be unreachable; then the invariant is true but not inductive: strengthen it, or `explore`."
// k.prove, Rules "The JSON is `{"transaction","state","payload"}` (`{"state"}` for `initial`); a string is the model's literal, else `a`, `b`, ... in order of first appearance."
// k.prove, Rules "When only an integer range breaks (Sorts, Obligations), the first line is `<tx> leaves the safe integer range from this state; bound the schema or guard it`."
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

const strings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(strings);
};

const named = (id: string) => {
  const st = store(s.object({ tag: s.string() }), { tag: "ok" }, { id: `${id}.tag` });
  invariant(st, (state) => state.tag === "ok");
  const set = transaction(st, `${id}.set`, s.object({ tag: s.string() }), (_state, p) => ({ tag: p.tag }));
  const pair = store(s.object({ x: s.string(), y: s.string() }), { x: "", y: "" }, { id: `${id}.pair` });
  invariant(pair, (state) => state.x === state.y);
  const swap = transaction(pair, `${id}.swap`, s.object({ x: s.string(), y: s.string() }), (_state, p) => ({
    x: p.x,
    y: p.y,
  }));
  const broken = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.broken` });
  invariant(broken, (state) => state.n >= 1);
  const inc = transaction(broken, `${id}.inc`, s.object({}), (state) => ({ n: state.n + 1 }));
  return { id, set, swap, inc };
};

describe("k.prove: E1716 JSON shape", () => {
  it(
    'the counterexample JSON is {"transaction","state","payload"} with the transaction\'s name',
    async () => {
      const { id, set } = build(named);
      const e = await rejection(() => prove([set]));
      expect(codeOf(e)).toBe("E1716");
      const json = jsonLine(e);
      expect(isRecord(json)).toBe(true);
      expect(isRecord(json) ? Object.keys(json).sort() : []).toEqual(["payload", "state", "transaction"]);
      expect(isRecord(json) ? json.transaction : undefined).toBe(`${id}.set`);
    },
    LONG,
  );

  it(
    'for initial the counterexample JSON is {"state"} alone',
    async () => {
      const { inc } = build(named);
      const e = await rejection(() => prove([inc]));
      expect(codeOf(e)).toBe("E1716");
      const json = jsonLine(e);
      expect(isRecord(json) ? Object.keys(json) : []).toEqual(["state"]);
    },
    LONG,
  );

  it(
    "a string in the counterexample is the model's literal, else a, b, ... in order of first appearance",
    async () => {
      const { set, swap } = build(named);
      const lit = await rejection(() => prove([set]));
      expect(codeOf(lit)).toBe("E1716");
      const j = jsonLine(lit);
      expect(isRecord(j) && isRecord(j.state) ? j.state.tag : undefined).toBe("ok");
      expect(isRecord(j) && isRecord(j.payload) ? j.payload.tag : undefined).toBe("a");

      const e = await rejection(() => prove([swap]));
      expect(codeOf(e)).toBe("E1716");
      const json = jsonLine(e);
      const body = isRecord(json) ? [strings(json.state), strings(json.payload)].flat() : [];
      const firstSeen = body.filter((v, i) => body.indexOf(v) === i);
      expect(firstSeen.length).toBeGreaterThanOrEqual(2);
      expect(firstSeen).toEqual(["a", "b", "c", "d"].slice(0, firstSeen.length));
    },
    LONG,
  );
});

const line = (tx: string) => `${tx} leaves the safe integer range from this state; bound the schema or guard it`;
const firstLine = (e: unknown): string => messageOf(e).split("\n")[0] ?? "";

const ranges = (id: string) => {
  const none = s.object({});
  const a = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.sinc` });
  const inc = transaction(a, `${id}.inc`, none, (state) => ({ n: state.n + 1 }));
  const b = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.sdbl` });
  const dbl = transaction(b, `${id}.dbl`, none, (state) => ({ n: state.n * 2 }));
  const c = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.sadd` });
  const add = transaction(c, `${id}.add`, s.object({ by: s.int({ min: 0 }) }), (state, p) => ({ n: state.n + p.by }));
  const d = store(s.object({ n: s.int({ min: 0, max: 9 }), m: s.int() }), { n: 0, m: 0 }, { id: `${id}.sboth` });
  invariant(d, (state) => state.n <= 5);
  const both = transaction(d, `${id}.both`, none, (state) => ({
    n: state.n < 9 ? state.n + 1 : state.n,
    m: state.m + 1,
  }));
  return { id, inc, dbl, add, both };
};

describe("k.prove: E1716 safe-range line", () => {
  it(
    "when only an integer range breaks the first line is the safe-range line, for n + 1, n * 2 and n + p.by, and data equals the JSON line",
    async () => {
      const f = build(ranges);
      const cases = [
        { t: f.inc, name: `${f.id}.inc` },
        { t: f.dbl, name: `${f.id}.dbl` },
        { t: f.add, name: `${f.id}.add` },
      ];
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 2 }), async (i) => {
          const c = cases[i];
          if (c === undefined) throw new Error("fixture: no case");
          const e = await rejection(() => prove([c.t]));
          expect(codeOf(e)).toBe("E1716");
          expect(firstLine(e)).toBe(line(c.name));
          expect(isRecord(e) ? e.data : undefined).toEqual(jsonLine(e));
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    LONG,
  );

  it(
    "a transaction that breaks an invariant and an integer range reports under the schema-or-invariant line, with the state's n at 5",
    async () => {
      const f = build(ranges);
      const e = await rejection(() => prove([f.both]));
      expect(codeOf(e)).toBe("E1716");
      expect(firstLine(e)).not.toBe(line(`${f.id}.both`));
      expect(valuesAt(jsonLine(e), "n")).toContain(5);
    },
    LONG,
  );
});
