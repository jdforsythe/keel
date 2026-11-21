// Spec: k.sim, Conformance "A `fail` storage step rejects that call and a failed `set` leaves the key's earlier value."
// Seed: 1337.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
type Step = "ok" | "fail";

const make = (storage: Step[]) =>
  createCtx({ mode: "sim", seed: SEED, schedule: { net: [], storage, offline: [], plans: {} } }).storage;

const attempt = async (p: Promise<unknown>) => {
  try {
    return { ok: true as const, value: await p };
  } catch (reason) {
    return { ok: false as const, reason };
  }
};

describe("k.sim: storage fail", () => {
  test("a `fail` storage step rejects a `get` with an `Error`", async () => {
    const st = make(["fail"]);
    const r = await attempt(st.get("k"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBeInstanceOf(Error);
  });

  test("a `fail` storage step rejects a `set` with an `Error`", async () => {
    const st = make(["fail"]);
    const r = await attempt(st.set("k", "v"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBeInstanceOf(Error);
  });

  test("a failed `set` leaves the key's earlier value", async () => {
    const st = make(["ok", "fail", "ok"]);
    await st.set("k", "earlier");
    expect((await attempt(st.set("k", "later"))).ok).toBe(false);
    expect(await st.get("k")).toBe("earlier");
  });

  test("a failed `set` of a missing key leaves it missing", async () => {
    const st = make(["fail", "ok"]);
    await attempt(st.set("k", "v"));
    expect(await st.get("k")).toBeNull();
  });

  test("the n-th `get` or `set` takes `storage[n]`, counting both kinds together", async () => {
    const st = make(["ok", "ok", "fail", "ok"]);
    await st.set("k", "a");
    expect(await st.get("k")).toBe("a");
    expect((await attempt(st.get("k"))).ok).toBe(false);
    expect(await st.get("k")).toBe("a");
  });

  test("property: a call fails exactly when its step is `fail`, and storage then equals a model that skips failed sets", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            step: fc.constantFrom<Step>("ok", "fail"),
            op: fc.constantFrom<"get" | "set">("get", "set"),
            key: fc.constantFrom("a", "b"),
            value: fc.string({ maxLength: 4 }),
          }),
          { maxLength: 12 },
        ),
        async (calls) => {
          const st = make(calls.map((c) => c.step));
          const model = new Map<string, string>();
          for (const c of calls) {
            const r = await attempt(c.op === "get" ? st.get(c.key) : st.set(c.key, c.value));
            expect(r.ok).toBe(c.step === "ok");
            if (c.step === "ok" && c.op === "set") model.set(c.key, c.value);
            if (c.step === "ok" && c.op === "get") expect(r.ok && r.value).toBe(model.get(c.key) ?? null);
          }
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});
