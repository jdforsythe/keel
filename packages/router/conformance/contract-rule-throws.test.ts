// Spec: k.routes, clause "`contract` throws E1503, E1504, E1653 and E1113 for an entry breaking each, and `keel check` reports E1503, E1504 and E1653 from the same contract file and no E1113; `loader` throws E1113 for a page loader whose `output` holds an `s.secret`; `action` throws none of these codes."
// The `keel check` half is packages/check/conformance/where-codes-check.test.ts. Seed 1337.
import { action, loader } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf } from "./contract-support.ts";

const Id = s.object({ id: s.string() });
const Out = s.object({ n: s.int() });
const Secret = s.object({ token: s.secret(s.string()) });

const entries = {
  E1503: { "a.x": { path: "/o/:id" } },
  E1504: { "a.x": { path: "/o", search: s.object({ q: s.string() }) } },
  E1653: { "a.x": { method: "GET", path: "/o", body: s.object({}), output: Out } },
  E1113: { "a.x": { method: "GET", path: "/o", output: Secret } },
} as const;

describe("k.routes: rules thrown by contract, loader and action", () => {
  it("`contract` throws E1503, E1504, E1653 and E1113 for an entry breaking each", () => {
    fc.assert(
      fc.property(fc.constantFrom(...(["E1503", "E1504", "E1653", "E1113"] as const)), (code) => {
        expect(codeOf(() => Reflect.apply(contract, undefined, ["a", entries[code]]))).toBe(code);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`loader` throws E1113 for a page loader whose `output` holds an `s.secret`", () => {
    const c = contract("a", { "a.p": { path: "/p" } });
    const declare = (output: unknown) => () =>
      Reflect.apply(loader, undefined, [c, "a.p", { output }, async () => ok({})]);
    expect(codeOf(declare(Secret))).toBe("E1113");
    expect(codeOf(declare(Out))).toBeNull();
  });

  it("`action` throws none of these codes for a valid page action and API write", () => {
    const c = contract("a", {
      "a.p": { path: "/p/:id", params: Id },
      "a.w": { method: "POST", path: "/w", body: Out, output: Out },
    });
    const declare = () => {
      Reflect.apply(action, undefined, [c, "a.p", { input: Out }, () => ok(null)]);
      Reflect.apply(action, undefined, [c, "a.w", {}, () => ok({ n: 1 })]);
    };
    expect(codeOf(declare)).toBeNull();
  });
});
