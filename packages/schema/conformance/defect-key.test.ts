// Spec: k.attempt, clause "With `d` a defect, `attempt(() => { throw new Error('w', { cause: d }) }, spy)` and `attempt(() => Promise.any([Promise.reject(d)]), spy)` throw or reject with the wrapping value itself and never call `spy`."
// Spec: k.defects, clause "For `v` a value made by `defect('x', { code: 'E2801' })`, `structuredClone(v)` and the value a worker receives by `postMessage(v)` are not `isDefect`; a second copy of `@keel/schema` does not load beside the first (k.realm)."
// Seed 1337. The clause's last half (a second copy of `@keel/schema` does not load beside the first) is asserted in second-copy.test.ts (k.realm).
// Assumption: "at most 8 steps" counts each `cause` or `errors` member followed as one step: a wrapper holding the defect is 1 step, so 8 wrappers skip `expect` and 9 do not.
import { Worker } from "node:worker_threads";
import { attempt, defect, isDefect } from "@keel/schema";
import type { KeelError } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const thrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
};
const rejected = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );
const code = fc.integer({ min: 1000, max: 9999 }).map((n): `E${number}` => `E${n}`);

type Expect = (x: unknown) => KeelError<"x.y", null> | undefined;
/** A spy `expect` that records every value it is handed. */
const spy = (): { expect: Expect; seen: unknown[] } => {
  const seen: unknown[] = [];
  return {
    seen,
    expect: (x) => {
      seen.push(x);
      return undefined;
    },
  };
};

/** The defect `defect(message, { code })` throws. */
const made = (message: string, c?: `E${number}`): unknown =>
  thrown(() => (c === undefined ? defect(message) : defect(message, { code: c })));

/** `d` wrapped `path.length` times, each step through `cause` or through `errors` (an `AggregateError`'s). */
const wrap = (d: unknown, path: readonly ("cause" | "errors")[]): unknown =>
  path.reduceRight<unknown>(
    (inner, step) => (step === "cause" ? new Error("w", { cause: inner }) : new AggregateError([inner], "w")),
    d,
  );

describe("k.errors: attempt's expect never sees a value wrapping a defect", () => {
  it("attempt(() => { throw new Error('w', { cause: d }) }, spy) throws the wrapping value itself and never calls spy", () => {
    const d = made("x", "E2801");
    const w = new Error("w", { cause: d });
    const s = spy();
    const v = thrown(() =>
      attempt(() => {
        throw w;
      }, s.expect),
    );
    expect(v).toBe(w);
    expect(s.seen).toEqual([]);
  });

  it("attempt(() => Promise.any([Promise.reject(d)]), spy) rejects with the wrapping value itself and never calls spy", async () => {
    const d = made("x", "E2801");
    const s = spy();
    const v = await rejected(attempt(() => Promise.any([Promise.reject(d)]), s.expect));
    expect(v).toBeInstanceOf(AggregateError);
    expect(v instanceof AggregateError && v.errors).toEqual([d]);
    expect(s.seen).toEqual([]);
  });

  it("an async function throwing a value that wraps a defect rejects with that value itself and never calls spy", async () => {
    const d = made("x");
    const w = new Error("w", { cause: d });
    const s = spy();
    const v = await rejected(
      attempt(async () => {
        throw w;
      }, s.expect),
    );
    expect(v).toBe(w);
    expect(s.seen).toEqual([]);
  });

  it("property: a defect reachable through `cause` and `errors` in 1 to 8 steps, in any order of the two, is thrown on unchanged, sync and async, and spy is never called", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom<"cause" | "errors">("cause", "errors"), { minLength: 1, maxLength: 8 }),
        fc.string(),
        fc.option(code, { nil: undefined }),
        async (path, message, c) => {
          const d = made(message, c);
          const w = wrap(d, path);
          const s = spy();
          const sync = thrown(() =>
            attempt(() => {
              throw w;
            }, s.expect),
          );
          expect(sync).toBe(w);
          const later = await rejected(
            attempt(async () => {
              throw w;
            }, s.expect),
          );
          expect(later).toBe(w);
          expect(s.seen).toEqual([]);
        },
      ),
      opts,
    );
  });

  it("property: a defect more than 8 steps down is no wrapped defect, so spy is handed the value; returning undefined still throws it on unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<"cause" | "errors">("cause", "errors"), { minLength: 9, maxLength: 12 }),
        (path) => {
          const w = wrap(made("x", "E2801"), path);
          const s = spy();
          const v = thrown(() =>
            attempt(() => {
              throw w;
            }, s.expect),
          );
          expect(v).toBe(w);
          expect(s.seen).toEqual([w]);
        },
      ),
      opts,
    );
  });

  it("a value wrapping no defect, through `cause` or `errors`, goes to expect as any other value does", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<"cause" | "errors">("cause", "errors"), { minLength: 1, maxLength: 8 }),
        (path) => {
          const w = wrap(new Error("plain"), path);
          const s = spy();
          expect(
            thrown(() =>
              attempt(() => {
                throw w;
              }, s.expect),
            ),
          ).toBe(w);
          expect(s.seen).toEqual([w]);
        },
      ),
      opts,
    );
  });
});

const WORKER_ECHO = `
const { parentPort } = require('node:worker_threads')
parentPort.once('message', (m) => parentPort.postMessage(m))
`;
const viaWorker = (value: unknown): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const w = new Worker(WORKER_ECHO, { eval: true });
    w.once("message", (m: unknown) => {
      void w.terminate().then(() => resolve(m));
    });
    w.once("error", reject);
    w.postMessage(value);
  });

describe("k.defects: the defect mark is lost by every copy of the value", () => {
  it("`structuredClone(v)` is not `isDefect`", () => {
    fc.assert(
      fc.property(fc.string(), code, (message, c) => {
        const v = made(message, c);
        expect(isDefect(structuredClone(v))).toBe(false);
        expect(isDefect(structuredClone(v), c)).toBe(false);
      }),
      opts,
    );
  });

  it("the value a worker receives by `postMessage(v)` is not `isDefect`", async () => {
    const v = made("x", "E2801");
    const received = await viaWorker(v);
    expect(received).toBeDefined();
    expect(isDefect(received)).toBe(false);
    expect(isDefect(received, "E2801")).toBe(false);
  });

  it("a value that crossed JSON is not `isDefect`", () => {
    const v = made("x", "E2801");
    expect(isDefect(JSON.parse(JSON.stringify(v)))).toBe(false);
  });

  it("the receiver raises its own: `defect(message, { code })` again is `isDefect(v, code)`", () => {
    const cloned = structuredClone(made("x", "E2801"));
    const message = cloned instanceof Error ? cloned.message : "";
    const again = thrown(() => defect("x", { code: "E2801" }));
    expect(message).toBe("E2801 x");
    expect(isDefect(again, "E2801")).toBe(true);
  });
});
