// Spec: std.lists, Conformance "A key that is not 1 to 64 of `[A-Za-z0-9_-]` in `options` throws E2801 at the `listChart` call."
// Seed: 1337. The code is read from the thrown message, as keys-e2801.test.ts does.
import { listChart } from "@keel/std-headless";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, inScope } from "./lists-support.ts";

const codeOf = (e: unknown): string | undefined =>
  typeof e === "object" && e !== null && "code" in e && typeof e.code === "string"
    ? e.code
    : e instanceof Error
      ? /\bE\d{4}\b/.exec(e.message)?.[0]
      : undefined;
const call = (keys: readonly string[]): unknown => {
  try {
    inScope(() => listChart("w", "option", () => keys.map((key) => ({ key, text: "t" }))));
    return undefined;
  } catch (e) {
    return e;
  }
};

describe("std.lists: E2801", () => {
  test("a key with a space, a dot, or an empty or 65-character key throws E2801 at the call", () => {
    for (const bad of ["a b", "a.b", "", "x".repeat(65)]) expect(codeOf(call([bad]))).toBe("E2801");
  });

  test("keys of 1 to 64 of `[A-Za-z0-9_-]` do not throw", () => {
    expect(call(["a", "x".repeat(64), "A_b-9"])).toBeUndefined();
  });

  test("a repeated key throws E2801", () => {
    expect(codeOf(call(["a", "a"]))).toBe("E2801");
  });

  test("property: a key outside the alphabet throws E2801 whatever its position", () => {
    const ok = fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/);
    const bad = fc.stringMatching(/^[A-Za-z0-9_-]{0,3}[ .!:/][A-Za-z0-9_-]{0,3}$/);
    fc.assert(
      fc.property(fc.array(ok, { maxLength: 3 }), bad, (before, k) => {
        const unique = [...new Set(before)];
        expect(codeOf(call([...unique, k]))).toBe("E2801");
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
