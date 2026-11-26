// Generated `set` and `commit` sequences against a model map: the driver's stored values, its `read` and each
// `commit` result agree with the model run serially, whether the calls are awaited one by one or issued at once.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Cell } from "../src/internal/Cell.ts";
import { cellStorage } from "../src/internal/cellStorage.ts";

const run = { seed: 1337, numRuns: 200 };
/** One run is at most 12 calls that each yield to the event loop once or twice: a few ms alone. Each gets 500 ms, the machine's own work with a wide margin, so fixed time. The property-time transform cannot read `numRuns` from `run`, so each test states its time. */
const RUN_MS = 500;
const key = fc.constantFrom("a", "b", "c", "d");
const val = fc.option(fc.constantFrom("1", "2", "3"), { nil: null });
const op = fc.oneof(
  fc.record({ kind: fc.constant("set" as const), key, value: fc.constantFrom("1", "2", "3") }),
  fc.record({
    kind: fc.constant("commit" as const),
    writes: fc.uniqueArray(
      fc.record({ key, expect: val, value: fc.option(fc.constantFrom("1", "2", "3"), { nil: undefined }) }),
      {
        maxLength: 4,
        selector: (w) => w.key,
      },
    ),
  }),
);

/** An in-memory cell whose every call yields to the event loop first, so calls issued at once interleave. */
function memoryCell(): { cell: Cell; data: Map<string, string> } {
  const data = new Map<string, string>();
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));
  return {
    data,
    cell: {
      get: async (k) => {
        await tick();
        return data.get(k) ?? null;
      },
      put: async (entries) => {
        for (const [k, v] of entries) {
          await tick();
          data.set(k, v);
        }
      },
    },
  };
}

type Op = typeof op extends fc.Arbitrary<infer T> ? T : never;
function model(ops: readonly Op[]): { results: boolean[]; data: Map<string, string> } {
  const data = new Map<string, string>();
  const results: boolean[] = [];
  for (const o of ops) {
    if (o.kind === "set") {
      data.set(o.key, o.value);
      continue;
    }
    const ok = o.writes.every((w) => (data.get(w.key) ?? null) === w.expect);
    if (ok) for (const w of o.writes) if (w.value !== undefined) data.set(w.key, w.value);
    results.push(ok);
  }
  return { results, data };
}

describe("cellStorage against a model map", () => {
  test(
    "sequences awaited one by one agree with the model",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(op, { maxLength: 12 }), async (ops) => {
          const { cell, data } = memoryCell();
          const st = cellStorage(cell);
          const results: boolean[] = [];
          for (const o of ops) {
            if (o.kind === "set") await st.set(o.key, o.value);
            else results.push(await st.commit(o.writes));
          }
          const want = model(ops);
          expect(results).toEqual(want.results);
          expect(data).toEqual(want.data);
          expect(await st.read(["a", "b", "c", "d"])).toEqual(
            ["a", "b", "c", "d"].map((k) => want.data.get(k) ?? null),
          );
        }),
        run,
      );
    },
    run.numRuns * fixedTime(RUN_MS),
  );

  test(
    "sequences issued at once agree with the model run in call order",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(op, { maxLength: 12 }), async (ops) => {
          const { cell, data } = memoryCell();
          const st = cellStorage(cell);
          const pending = ops.map((o) =>
            o.kind === "set" ? st.set(o.key, o.value).then(() => null) : st.commit(o.writes),
          );
          const results = (await Promise.all(pending)).filter((r): r is boolean => r !== null);
          const want = model(ops);
          expect(results).toEqual(want.results);
          expect(data).toEqual(want.data);
        }),
        run,
      );
    },
    run.numRuns * fixedTime(RUN_MS),
  );

  test(
    "a commit naming one key twice rejects with E1606, stores nothing and leaves later calls running",
    async () => {
      await fc.assert(
        fc.asyncProperty(key, fc.constantFrom("1", "2"), async (k, v) => {
          const { cell, data } = memoryCell();
          const st = cellStorage(cell);
          const err = await st
            .commit([
              { key: k, expect: null, value: v },
              { key: k, expect: null },
            ])
            .then(
              () => null,
              (e: unknown) => e,
            );
          expect(Reflect.get(Object(err), "code")).toBe("E1606");
          expect(String(Reflect.get(Object(err), "message"))).not.toContain(`"${k}"`);
          expect(data.size).toBe(0);
          expect(await st.commit([{ key: k, expect: null, value: v }])).toBe(true);
        }),
        run,
      );
    },
    run.numRuns * fixedTime(RUN_MS),
  );
});
