// Spec: k.realm, clause "Evaluating `@keel/schema` again from the same file with a fresh module graph throws nothing, and a schema the first evaluation made is not `isSchema` under the second."
// Seed 1337 (no generated input).
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it, vi } from "vitest";

describe("k.realm One copy: the same file again", () => {
  it(
    "evaluating `@keel/schema` again from the same file with a fresh module graph throws nothing, and a schema the first evaluation made is not `isSchema` under the second",
    async () => {
      const first = await import("@keel/schema");
      const made = first.s.object({ n: first.s.int() });
      vi.resetModules();
      const second = await import("@keel/schema");
      expect(second).not.toBe(first);
      expect(first.isSchema(made)).toBe(true);
      expect(second.isSchema(made)).toBe(false);
      expect(second.isSchema(second.s.string())).toBe(true);
    },
    testTime(120_000),
  );

  it(
    "a defect the first evaluation made is not `isDefect` under the second",
    async () => {
      const first = await import("@keel/schema");
      const d = (() => {
        try {
          return first.defect("x");
        } catch (e) {
          return e;
        }
      })();
      vi.resetModules();
      const second = await import("@keel/schema");
      expect(first.isDefect(d)).toBe(true);
      expect(second.isDefect(d)).toBe(false);
    },
    testTime(120_000),
  );
});
