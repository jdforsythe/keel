// @vitest-environment happy-dom
// Spec: k.testing, clause "A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case."
// Seed: 1337.
import { properties } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { SEED, addAny, codeOf, messageOf, thrown } from "./fixtures.ts";

const payloadLine = (msg: string): string | undefined => msg.split("\n").find((l) => l.trim().startsWith("payload:"));

const withEnv = async <T>(value: string, fn: () => Promise<T>): Promise<T> => {
  const prev = process.env.KEEL_SEED;
  process.env.KEEL_SEED = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) Reflect.deleteProperty(process.env, "KEEL_SEED");
    else process.env.KEEL_SEED = prev;
  }
};

describe("k.testing: a failing property prints the shrunk case per OUTPUT.md", () => {
  it("the failure message contains the seed, the run count, and the shrunk counterexample, in under 10 lines", async () => {
    const e = await thrown(() => properties(addAny, { runs: 100, seed: SEED }));
    const msg = messageOf(e);
    expect(msg).toContain("E1704");
    expect(msg).toContain(`seed ${SEED}`);
    expect(msg).toMatch(/run \d+/);
    expect(msg).toContain("shrunk");
    expect(payloadLine(msg)).toBeDefined();
    expect(msg.split("\n").length).toBeLessThan(10);
  });

  it("the shrunk payload is minimal for the violated invariant: a single item with qty -1", async () => {
    const msg = messageOf(await thrown(() => properties(addAny, { runs: 100, seed: SEED })));
    expect(payloadLine(msg)).toContain('"qty":-1');
  });
});

describe("k.testing: a property failing at a seed reports that seed; re-running with KEEL_SEED reproduces the same shrunk case", () => {
  it("re-running with the same seed option reproduces the same shrunk case", async () => {
    const a = messageOf(await thrown(() => properties(addAny, { runs: 100, seed: SEED })));
    const b = messageOf(await thrown(() => properties(addAny, { runs: 100, seed: SEED })));
    expect(payloadLine(b)).toBe(payloadLine(a));
  });

  it("the reported seed, set as KEEL_SEED, reproduces the same shrunk case", async () => {
    const first = messageOf(await thrown(() => properties(addAny, { runs: 100 })));
    const seed = /seed (-?\d+)/.exec(first)?.[1];
    expect(seed).toBeDefined();
    if (seed === undefined) return;
    const replay = await withEnv(seed, async () => messageOf(await thrown(() => properties(addAny, { runs: 100 }))));
    expect(replay).toContain(`seed ${seed}`);
    expect(payloadLine(replay)).toBe(payloadLine(first));
  });

  it("the thrown error carries code E1704", async () => {
    expect(codeOf(await thrown(() => properties(addAny, { runs: 100, seed: SEED })))).toBe("E1704");
  });
});
