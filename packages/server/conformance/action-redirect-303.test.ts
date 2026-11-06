// @vitest-environment happy-dom
// Clause: For a document request, `ok(href)` yields 303 with `Location: href`; `ok(null)` yields 303 to the request URL.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ok } from "@keel/schema";
import { BASE, build, kinds, post } from "./fixtures.ts";

describe("k.server", () => {
  it("For a document request, `ok(href)` yields 303 with `Location: href`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...kinds), fc.constantFrom(...kinds), async (from, to) => {
        const probe = await build({});
        const target = probe.href("orders.show", { kind: to });
        const { app, n } = await build({ act: () => ok(target) });
        const res = await app.fetch(post(`/orders/${from}`, { kind: from, note: "n" }));
        expect(res.status).toBe(303);
        expect(new URL(res.headers.get("location") ?? "", BASE).pathname).toBe(`/orders/${to}`);
        expect(n.act).toBe(1);
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  it("For a document request, `ok(null)` yields 303 to the request URL", async () => {
    const { app } = await build({ act: () => ok(null) });
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...kinds), fc.constantFrom("items", "history"), async (kind, tab) => {
        const url = `${BASE}/orders/${kind}?tab=${tab}`;
        const res = await app.fetch(post(`/orders/${kind}?tab=${tab}`, { kind, note: "n" }));
        expect(res.status).toBe(303);
        expect(new URL(res.headers.get("location") ?? "", BASE).href).toBe(url);
      }),
      { seed: 1337, numRuns: 10 },
    );
  });
});
