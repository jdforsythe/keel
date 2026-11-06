// @vitest-environment happy-dom
// Clause: A GET with params that fail the params schema returns 404 and calls no loader.
// Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { build, get, kinds } from "./fixtures.ts";

describe("k.server", () => {
  it("A GET with params that fail the params schema returns 404 and calls no loader", async () => {
    const { app, n } = await build({});
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 12 }).filter((v) => !kinds.some((k) => k === v) && !v.includes("/")),
        async (bad) => {
          const res = await app.fetch(get(`/orders/${encodeURIComponent(bad)}`));
          expect(res.status).toBe(404);
          expect(n.show + n.shell + n.root).toBe(0);
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });
});
