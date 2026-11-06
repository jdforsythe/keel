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

describe("k.services: non-2xx yields api.status", () => {
  const Conflict = s.object({ reason: s.string() });
  const api = service({
    base: BASE,
    schema: endpoints({
      act: { method: "POST", path: "/act", body: s.object({}), output: s.object({}), errors: { 409: Conflict } },
    }),
  });

  it("A 409 with `errors: { 409: Conflict }` yields `api.status` with a decoded body", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (reason) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/act`, async () => new Response(JSON.stringify({ reason }), { status: 409 }));
        const r = await api.act({ body: {} }, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.status");
          expect(r.error.data.status).toBe(409);
          expect(r.error.data.body).toEqual({ reason });
        }
      }),
      { seed: 1337 },
    );
  });

  it("an undeclared 500 yields `api.status` with `body: null`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }).filter((n) => n !== 409),
        fc.string(),
        async (status, text) => {
          const ctx = createCtx({ mode: "sim", seed: 1337 });
          ctx.net.route(`${BASE}/act`, async () => new Response(JSON.stringify({ text }), { status }));
          const r = await api.act({ body: {} }, ctx);
          expect(r.ok).toBe(false);
          if (!r.ok) {
            expect(r.error.code).toBe("api.status");
            expect(r.error.data.status).toBe(status);
            expect(r.error.data.body).toBeNull();
          }
        },
      ),
      { seed: 1337 },
    );
  });
});
