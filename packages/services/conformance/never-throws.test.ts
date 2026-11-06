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


describe("k.services: client never throws", () => {
  it("For generated responses of any status and body, no client call throws", async () => {
    const api = service({
      base: BASE,
      schema: endpoints({ get: { method: "GET", path: "/x", output: s.object({ n: s.int() }), errors: { 404: s.object({ m: s.string() }) } } }),
    });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 100, max: 599 }).filter((n) => n !== 101 && n !== 204 && n !== 205 && n !== 304 && n >= 200), fc.oneof(fc.string(), fc.json()), async (status, body) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/x`, async () => new Response(body, { status }));
        const r = await api.get({}, ctx);
        expect(typeof r.ok).toBe("boolean");
        if (!r.ok) expect(["api.status", "api.decode", "api.timeout", "api.network"]).toContain(r.error.code);
      }),
      { seed: 1337 },
    );
  });
});
