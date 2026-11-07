import { createCtx } from "@keel/ctx";
import { reveal, s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
// seed 1337 (fast-check runs below pass { seed: 1337 }); no wall clock, no Math.random.
// The output's decoded form differs from the raw JSON (a secret), so a pass-through of the raw body fails.
const BASE = "https://api.example.com";

describe("k.services: 2xx matching output yields ok with the decoded value", () => {
  it("A 2xx response whose body matches `output` yields `ok` with the decoded value, not the raw JSON", async () => {
    const Out = s.object({ n: s.int(), token: s.secret(s.string()) });
    const api = service({ base: BASE, schema: endpoints({ get: { method: "GET", path: "/items", output: Out } }) });
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -1000, max: 1000 }),
        fc.string(),
        fc.constantFrom(200, 201, 299),
        async (n, token, status) => {
          const ctx = createCtx({ mode: "sim", seed: 1337 });
          ctx.net.route(`${BASE}/items`, async () => new Response(JSON.stringify({ n, token }), { status }));
          const r = await api.get({}, ctx);
          expect(r.ok).toBe(true);
          if (r.ok) {
            expect(r.value.n).toBe(n);
            expect(reveal(r.value.token)).toBe(token);
            expect(r.value).not.toEqual({ n, token });
            expect(JSON.stringify(r.value.token)).toBe('"[secret]"');
          }
        },
      ),
      { seed: 1337 },
    );
  });
});
