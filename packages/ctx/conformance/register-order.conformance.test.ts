// k.ctx registry (order independence: a capability resolves on any ctx, whenever the ctx was created)
import { describe, expect, test } from "vitest";
import { capabilities, createCtx, register } from "@keel/ctx";

const MODES = ["real", "shell", "sim"] as const;

describe("k.ctx register order", () => {
  test("a ctx created before register sees the capability in real, shell and sim", () => {
    const early = MODES.map((mode) => createCtx({ mode, seed: 5 }));
    const lateCap = register("orderLate", {
      real: () => ({ who: "real" }),
      shell: () => ({ who: "shell" }),
      sim: () => ({ who: "sim" }),
    });
    expect(early.map((c) => lateCap(c).who)).toEqual(["real", "shell", "sim"]);
    expect(capabilities()).toContain("orderLate");
  });

  test("a ctx created after register sees it too, and both orders agree", () => {
    const early = createCtx({ mode: "sim", seed: 9 });
    const cap = register("orderBoth", {
      real: () => ({ n: -1 }),
      shell: () => ({ n: -1 }),
      sim: ({ seed }) => ({ n: seed }),
    });
    const late = createCtx({ mode: "sim", seed: 9 });
    expect(cap(early).n).toBe(cap(late).n);
  });

  test("the capability is stable per ctx and distinct across ctxs", () => {
    const early = createCtx({ mode: "sim", seed: 1 });
    const cap = register("orderStable", {
      real: () => ({}),
      shell: () => ({}),
      sim: () => ({}),
    });
    expect(cap(early)).toBe(cap(early));
    expect(cap(early)).not.toBe(cap(createCtx({ mode: "sim", seed: 1 })));
  });
});
