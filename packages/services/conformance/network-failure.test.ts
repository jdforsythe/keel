import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
// seed 1337 (fast-check runs below pass { seed: 1337 }); no wall clock, no Math.random.
// ASSUMPTION (public API not visible from index.ts): sim net is `ctx.net.route(url, handler)` where the
// handler receives a request with `url`/`signal` and returns a standard Response; sim clock has `advance(ms)`.
const BASE = "https://api.example.com";
const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};

describe("k.services: network failure", () => {
  it("A rejected `fetch` yields `api.network`", async () => {
    const api = service({
      base: BASE,
      schema: endpoints({ get: { method: "GET", path: "/x", output: s.object({}) } }),
    });
    await fc.assert(
      fc.asyncProperty(fc.string(), async (msg) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/x`, () => Promise.reject(new Error(msg)));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe("api.network");
      }),
      { seed: 1337 },
    );
  });
});
