// Spec: k.reactive, clause "resource state transitions are exactly loading -> ready | error".
import { describe, expect, it } from "vitest";
import { effect, resource, scope } from "@keel/reactive";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve(v: T): void;
  reject(e: unknown): void;
}
const deferred = <T>(): Deferred<T> => {
  let resolve: (v: T) => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const collapse = (xs: string[]): string[] => xs.filter((x, i) => x !== xs[i - 1]);

const at = <T>(arr: readonly T[], i: number): T => {
  const v = arr[i];
  if (v === undefined) throw new Error(`missing element ${i}`);
  return v;
};

describe("k.reactive: resource transitions", () => {
  it("starts in loading synchronously", () => {
    const d = deferred<number>();
    scope(
      () => {
        const r = resource(() => d.promise);
        expect(r.get()).toEqual({ state: "loading" });
      },
      { detached: true },
    );
  });

  it("loading -> ready carries the value", async () => {
    const d = deferred<number>();
    const states: string[] = [];
    let get: () => { state: string; value?: number } = () => ({ state: "" });
    scope(
      () => {
        const r = resource(() => d.promise);
        get = () => r.get();
        effect(() => {
          states.push(r.get().state);
        });
      },
      { detached: true },
    );
    d.resolve(42);
    await flush();
    expect(collapse(states)).toEqual(["loading", "ready"]);
    expect(get()).toEqual({ state: "ready", value: 42 });
  });

  it("loading -> error carries the error", async () => {
    const d = deferred<number>();
    const boom = new Error("boom");
    const states: string[] = [];
    let get: () => { state: string; error?: unknown } = () => ({ state: "" });
    scope(
      () => {
        const r = resource(() => d.promise);
        get = () => r.get();
        effect(() => {
          states.push(r.get().state);
        });
      },
      { detached: true },
    );
    d.reject(boom);
    await flush();
    expect(collapse(states)).toEqual(["loading", "error"]);
    expect(get()).toEqual({ state: "error", error: boom });
  });

  it("never skips loading and never goes ready <-> error directly", async () => {
    const ds = [deferred<number>(), deferred<number>(), deferred<number>()];
    let i = 0;
    const states: string[] = [];
    let refetch: () => void = () => {};
    scope(
      () => {
        const r = resource(() => at(ds, i++).promise);
        refetch = () => r.refetch();
        effect(() => {
          states.push(r.get().state);
        });
      },
      { detached: true },
    );
    at(ds, 0).resolve(1);
    await flush();
    refetch();
    await flush();
    at(ds, 1).reject(new Error("x"));
    await flush();
    refetch();
    await flush();
    at(ds, 2).resolve(3);
    await flush();
    const seq = collapse(states);
    expect(seq[0]).toBe("loading");
    for (let k = 1; k < seq.length; k++) {
      const prev = seq[k - 1];
      const cur = seq[k];
      if (cur === "ready" || cur === "error") expect(prev).toBe("loading");
      expect(["loading", "ready", "error"]).toContain(cur);
    }
    expect(seq).toEqual(["loading", "ready", "loading", "error", "loading", "ready"]);
  });

  it("a settled resource stays settled with no further notifications", async () => {
    const d = deferred<number>();
    let runs = 0;
    scope(
      () => {
        const r = resource(() => d.promise);
        effect(() => {
          r.get();
          runs++;
        });
      },
      { detached: true },
    );
    d.resolve(1);
    await flush();
    const settled = runs;
    await flush();
    expect(runs).toBe(settled);
  });
});
