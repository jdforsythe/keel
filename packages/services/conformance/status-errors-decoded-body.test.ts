import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
// seed 1337 (fast-check runs below pass { seed: 1337 }); no wall clock, no Math.random.
// The declared error schema decodes to a form that differs from the raw JSON (a secret field).
const BASE = "https://api.example.com";

describe("k.services: declared non-2xx body is decoded by its schema", () => {
  const Conflict = s.object({ reason: s.string(), token: s.secret(s.string()) });
  const api = service({
    base: BASE,
    schema: endpoints({
      act: { method: "POST", path: "/act", body: s.object({}), output: s.object({}), errors: { 409: Conflict } },
    }),
  });

  it("A 409 with `errors: { 409: Conflict }` yields `api.status` whose body is the decoded value, not the raw JSON", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.string(), async (reason, token) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/act`, async () => new Response(JSON.stringify({ reason, token }), { status: 409 }));
        const r = await api.act({ body: {} }, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.status");
          expect(r.error.data.status).toBe(409);
          expect(r.error.data.body).not.toEqual({ reason, token });
          expect(JSON.stringify(r.error.data.body)).toBe(JSON.stringify({ reason, token: "[secret]" }));
        }
      }),
      { seed: 1337 },
    );
  });
});
