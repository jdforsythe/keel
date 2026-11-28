// Spec: std.messages, clause "For every generated entry and params, `formatMessage` of each object message returns a string with no `{`."
// Seed 1337, recorded in the fc.assert option below.
import { gen } from "@keel/schema/gen";
import { formatMessage } from "@keel/std-messages";
import fc from "fast-check";
import { expect, test } from "vitest";

const locales = ["en-US", "de-DE"] as const;

test("For every generated entry and params, `formatMessage` of each object message returns a string with no `{`.", async () => {
  const { Demo } = await import("./fixtures/Demo.schema.ts");
  fc.assert(
    fc.property(
      gen(Demo),
      fc.integer({ min: 0, max: 1_000_000 }),
      fc.constantFrom("a", "b"),
      fc.constantFrom(...locales),
      (entry, n, k, locale) => {
        for (const out of [formatMessage(entry.count, { n }, locale), formatMessage(entry.kind, { k }, locale)]) {
          expect(typeof out).toBe("string");
          expect(out).not.toContain("{");
        }
      },
    ),
    { seed: 1337, numRuns: 200 },
  );
});
