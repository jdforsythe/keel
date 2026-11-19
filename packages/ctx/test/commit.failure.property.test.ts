import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type StorageWrite, createCtx } from "../src/index.ts";
import { applyCommit } from "../src/internal/applyCommit.ts";

const KEYS = ["a", "b", "c"] as const;
const key = fc.constantFrom(...KEYS);

/** A `localStorage` over a Map whose writes (`setItem`, `removeItem`) throw where `fails(n)` says, n counting from 0. */
function fakeStorage(fails: (n: number) => boolean) {
  const data = new Map<string, string>();
  let n = 0;
  const step = (): void => {
    if (fails(n++)) throw new DOMException("Setting the value exceeded the quota", "QuotaExceededError");
  };
  return {
    data,
    storage: {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        step();
        data.set(k, v);
      },
      removeItem: (k: string) => {
        step();
        data.delete(k);
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a commit that throws midway stores nothing (k.persist)", () => {
  it("the nth write throwing restores every earlier write, newest first, and rejects with that error", () => {
    const data = new Map<string, string>([["b", "old"]]);
    const calls: string[] = [];
    const first = new Error("quota");
    const put = (k: string, v: string | null): void => {
      calls.push(`${k}=${String(v)}`);
      if (k === "c" && v === "3") throw first;
      if (v === null) data.delete(k);
      else data.set(k, v);
    };
    const writes: StorageWrite[] = [
      { key: "a", expect: null, value: "1" },
      { key: "b", expect: "old", value: "2" },
      { key: "c", expect: null, value: "3" },
    ];
    expect(() => applyCommit((k) => data.get(k) ?? null, put, writes)).toThrow(first);
    expect([...data]).toEqual([["b", "old"]]);
    expect(calls).toEqual(["a=1", "b=2", "c=3", "c=null", "b=old", "a=null"]);
  });

  it("a put-back that throws is skipped: the rest are restored and the first error still rejects", async () => {
    const { data, storage } = fakeStorage((n) => n === 2 || n === 3);
    vi.stubGlobal("localStorage", storage);
    const ctx = createCtx({ mode: "real" });
    data.set("b", "old");
    const err = await ctx.storage
      .commit([
        { key: "a", expect: null, value: "secret-value" },
        { key: "b", expect: "old", value: "2" },
        { key: "c", expect: null, value: "3" },
      ])
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(DOMException);
    expect(String(err)).toContain("QuotaExceededError");
    expect(String(err)).not.toMatch(/secret-value|"a"|"b"|"c"/);
    // write 3 (the put-back of c) threw and was skipped; b and a were still put back.
    expect([...data]).toEqual([["b", "old"]]);
  });

  it("real: commit sequences where some writes throw agree with a model map", async () => {
    // A write of "X" exceeds the quota; the model never holds "X", so a put-back never throws. Most writes expect the
    // model's current value, so most commits reach their writes.
    const planned = fc.record({
      key,
      stale: fc.constantFrom(false, false, false, false, true),
      value: fc.option(fc.constantFrom("0", "1", "X"), { nil: undefined, freq: 4 }),
    });
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.array(planned, { minLength: 1, maxLength: 4 }), { maxLength: 10 }),
        async (plans) => {
          const { data, storage } = fakeStorage(() => false);
          const quota = {
            ...storage,
            setItem: (k: string, v: string) => {
              if (v === "X") throw new DOMException("Setting the value exceeded the quota", "QuotaExceededError");
              storage.setItem(k, v);
            },
          };
          vi.stubGlobal("localStorage", quota);
          const ctx = createCtx({ mode: "real" });
          const model = new Map<string, string>();
          for (const plan of plans) {
            const writes: StorageWrite[] = plan.map(({ key: k, stale, value }) => {
              const now = model.get(k) ?? null;
              const expect = stale ? (now === "2" ? null : "2") : now;
              return value === undefined ? { key: k, expect } : { key: k, expect, value };
            });
            const got = await ctx.storage.commit(writes).then(
              (ok) => ok,
              (e: unknown) =>
                e instanceof DOMException ? e.name : typeof e === "object" && e !== null && "code" in e ? e.code : e,
            );
            let want: unknown = false;
            if (new Set(writes.map((w) => w.key)).size !== writes.length) want = "E1606";
            else if (writes.every((w) => (model.get(w.key) ?? null) === w.expect))
              if (writes.some((w) => w.value === "X")) want = "QuotaExceededError";
              else {
                for (const w of writes) if (w.value !== undefined) model.set(w.key, w.value);
                want = true;
              }
            expect(got).toBe(want);
            expect(Object.fromEntries(data)).toEqual(Object.fromEntries(model));
          }
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});
