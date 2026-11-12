// std.jobs job options: positive safe integers, else E2505; defaults 3 and 60000. Seed 1337
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { job } from "../src/job.ts";

const fn = async () => ok(null);
const input = s.object({});

test("any positive safe integer is kept; defaults are 3 and 60000", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), (n) => {
      expect(job({ input, attempts: n, timeoutMs: n }, fn)).toMatchObject({ attempts: n, timeoutMs: n });
    }),
    { seed: 1337 },
  );
  expect(job({ input }, fn)).toMatchObject({ attempts: 3, timeoutMs: 60_000 });
});

test("anything else throws E2505 naming the option", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.integer({ max: 0 }),
        fc.double().filter((n) => !Number.isSafeInteger(n)),
      ),
      (n) => {
        expect(() => job({ input, attempts: n }, fn)).toThrow(/E2505 job attempts/);
        expect(() => job({ input, timeoutMs: n }, fn)).toThrow(/E2505 job timeoutMs/);
      },
    ),
    { seed: 1337 },
  );
});
