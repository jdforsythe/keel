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


describe("k.services: 2xx failing output yields api.decode", () => {
  it("A 2xx response whose body fails `output` yields `err` with `api.decode`, never `ok`", async () => {
    const Item = s.object({ n: s.int() });
    const api = service({ base: BASE, schema: endpoints({ get: { method: "GET", path: "/items", output: Item } }) });
    await fc.assert(
      fc.asyncProperty(fc.string(), async (bad) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/items`, async () => new Response(JSON.stringify({ n: bad }), { status: 200 }));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.decode");
          expect(Array.isArray(r.error.data.issues)).toBe(true);
        }
      }),
      { seed: 1337 },
    );
  });
});
