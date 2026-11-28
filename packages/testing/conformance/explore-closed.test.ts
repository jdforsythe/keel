// Spec: k.model, clause "A closed form over a store whose space closes returns `complete: true`; one missing a transaction of the store, or whose space exceeds `maxStates`, fails with E1710 or E1709."
// Seed: 1337.
// k.model, Rules "E1709 `maxStates` reached before the space or `depth` was exhausted, or a closed form that did not close"
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import { describe, expect, it } from "vitest";

const made = (() => {
  let out: ReturnType<typeof mk> | undefined;
  scope(
    () => {
      out = mk();
    },
    { detached: true },
  );
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();
function mk() {
  const light = store(
    s.object({ phase: s.enum(["red", "green", "yellow"]) }),
    { phase: "red" },
    { id: "closed.light" },
  );
  type Light = { readonly phase: "red" | "green" | "yellow" };
  const next = transaction(
    light,
    "closed.next",
    s.object({}),
    (state): Light => ({ phase: state.phase === "red" ? "green" : state.phase === "green" ? "yellow" : "red" }),
  );
  const toRed = transaction(light, "closed.toRed", s.object({}), (): Light => ({ phase: "red" }));
  // 100 states in a line: n only goes up, so the space closes at 99 but not before
  const line = store(s.object({ n: s.int({ min: 0, max: 99 }) }), { n: 0 }, { id: "closed.line" });
  const inc = transaction(line, "closed.inc", s.object({}), (state) => ({ n: Math.min(99, state.n + 1) }));
  return { light, next, toRed, line, inc };
}
const { next, toRed, inc } = made;

const thrownSync = (fn: () => unknown): unknown => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);
const messageOf = (e: unknown): string => (isRecord(e) && typeof e.message === "string" ? e.message : String(e));

describe("k.model: closed form", () => {
  it("a closed form over a store whose space closes returns complete: true", () => {
    const r = explore([next, toRed]);
    expect(r.complete).toBe(true);
    expect(r.states).toEqual([{ phase: "red" }, { phase: "green" }, { phase: "yellow" }]);
    expect(r.edges).toBe(6);
  });

  it("a closed form names its transactions in any order and still closes", () => {
    const r = explore([toRed, next]);
    expect(r.complete).toBe(true);
    expect(r.states).toHaveLength(3);
  });

  it("a closed form over a line of 100 states closes when maxStates allows it", () => {
    const r = explore([inc], { maxStates: 1000 });
    expect(r.complete).toBe(true);
    expect(r.states).toHaveLength(100);
    expect(r.depth).toBe(99);
  });

  it("a closed form missing a transaction of the store fails with E1710", () => {
    expect(codeOf(thrownSync(() => explore([next])))).toBe("E1710");
    expect(codeOf(thrownSync(() => explore([toRed])))).toBe("E1710");
  });

  it("a closed form whose space exceeds maxStates fails with E1709", () => {
    const e = thrownSync(() => explore([inc], { maxStates: 10 }));
    expect(codeOf(e)).toBe("E1709");
  });
});

describe("k.model: E1709", () => {
  it("maxStates reached before the space is exhausted is E1709 and the message carries the counts", () => {
    const e = thrownSync(() => explore([inc], { from: { n: 0 }, depth: 50, maxStates: 10 }));
    expect(codeOf(e)).toBe("E1709");
    expect(messageOf(e)).toContain("10");
  });

  it("a run that stops at depth with room under maxStates is not E1709 and is not complete", () => {
    const r = explore([inc], { from: { n: 0 }, depth: 3, maxStates: 10 });
    expect(r.states).toEqual([{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }]);
    expect(r.complete).toBe(false);
  });

  it("a closed form that did not close is E1709", () => {
    expect(codeOf(thrownSync(() => explore([inc], { maxStates: 99 })))).toBe("E1709");
  });
});
