import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import { describe, expect, it } from "vitest";
// No randomness; the null-body statuses are enumerated (204, 205, 304).
const BASE = "https://api.example.com";

describe("k.services: client never throws on null-body statuses", () => {
  const api = service({
    base: BASE,
    schema: endpoints({
      get: {
        method: "GET",
        path: "/x",
        output: s.object({ n: s.int() }),
        errors: { 404: s.object({ m: s.string() }) },
      },
    }),
  });
  for (const status of [204, 205, 304]) {
    it(`For a ${status} response with a null body (new Response(null, { status })), no client call throws`, async () => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      ctx.net.route(`${BASE}/x`, async () => new Response(null, { status }));
      const r = await api.get({}, ctx);
      expect(typeof r.ok).toBe("boolean");
      if (!r.ok) {
        expect(["api.status", "api.decode", "api.input", "api.timeout", "api.network"]).toContain(r.error.code);
        if (status === 304) {
          expect(r.error.code).toBe("api.status");
          expect(r.error.data.status).toBe(304);
          expect(r.error.data.body).toBeNull();
        }
      }
      if (status === 304) expect(r.ok).toBe(false);
    });
  }
});
