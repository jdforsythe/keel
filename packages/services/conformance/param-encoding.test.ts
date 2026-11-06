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

describe("k.services: encoding", () => {
  const api = service({
    base: BASE,
    schema: endpoints({
      get: { method: "GET", path: "/orders/:id", params: s.object({ id: s.string() }), output: s.object({}) },
    }),
  });
  const seen = async (id: string): Promise<string> => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    let url = "";
    ctx.net.route(`${BASE}/orders/*`, async (req) => {
      url = req.url;
      return new Response("{}", { status: 200 });
    });
    await api.get({ params: { id } }, ctx);
    return url;
  };

  it("Param value `a/b` is sent as `a%2Fb`", async () => {
    expect(await seen("a/b")).toBe(`${BASE}/orders/a%2Fb`);
  });

  it("path params are URL-encoded for any value (decodeURIComponent of the segment round-trips)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (id) => {
        const url = await seen(id);
        expect(url.startsWith(`${BASE}/orders/`)).toBe(true);
        const segment = url.slice(`${BASE}/orders/`.length);
        expect(segment).not.toContain("/");
        expect(decodeURIComponent(segment)).toBe(id);
      }),
      { seed: 1337 },
    );
  });
});
