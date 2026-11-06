// @vitest-environment happy-dom
// Clause: A loader returning `err` with `keel.notFound` yields 404 and the route's `errorElement` HTML.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { err } from "@keel/schema";
import { build, get, kinds, notFound } from "./fixtures.ts";

describe("k.server", () => {
  it("A loader returning `err` with `keel.notFound` yields 404 and the route's `errorElement` HTML", async () => {
    const { app } = await build({ show: () => Promise.resolve(err(notFound.make({}))) });
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...kinds), async (kind) => {
        const res = await app.fetch(get(`/orders/${kind}`));
        expect(res.status).toBe(404);
        const body = await res.text();
        expect(body).toContain('data-error-element="1"');
        expect(body).toContain("keel.notFound");
        expect(body).not.toContain('data-page="show"');
      }),
      { seed: 1337, numRuns: 10 },
    );
  });
});
