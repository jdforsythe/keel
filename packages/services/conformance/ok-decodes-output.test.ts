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


describe("k.services: 2xx matching output yields ok", () => {
  it("A 2xx response whose body matches `output` yields `ok` with the decoded value", async () => {
    const Item = s.object({ n: s.int(), name: s.string() });
    const api = service({ base: BASE, schema: endpoints({ get: { method: "GET", path: "/items", output: Item } }) });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), fc.string(), fc.constantFrom(200, 201, 200, 299), async (n, name, status) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/items`, async () => new Response(JSON.stringify({ n, name }), { status }));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toEqual({ n, name });
      }),
      { seed: 1337 },
    );
  });
});
