import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
// Spec: k.services, clause "Invalid call input returns `err` `api.input` with issue paths prefixed params/query/body and sends no request."
// seed 1337 (fast-check runs below pass { seed: 1337 }); no wall clock, no Math.random.
// ASSUMPTION (public API not visible from index.ts): sim net is `ctx.net.route(url, handler)`.
const BASE = "https://api.example.com";

describe("k.services: invalid call input is api.input", () => {
  it("Invalid call input returns `err` `api.input` with issue paths prefixed params/query/body and sends no request", async () => {
    const api = service({
      base: BASE,
      schema: endpoints({
        post: {
          method: "POST",
          path: "/items/:id",
          params: s.object({ id: s.int() }),
          query: s.object({ page: s.int() }),
          body: s.object({ n: s.int() }),
          output: s.object({ ok: s.boolean() }),
        },
      }),
    });
    const good = { params: { id: 1 }, query: { page: 1 }, body: { n: 1 } };
    const notInt = fc.string().filter((x) => x.length > 0);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("params", "query", "body"), notInt, async (part, bad) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        let sent = 0;
        ctx.net.route(`${BASE}/*`, async () => {
          sent++;
          return new Response("{}", { status: 200 });
        });
        const field = part === "params" ? "id" : part === "query" ? "page" : "n";
        const input = { ...good, [part]: { [field]: bad } };
        const r = await api.post(input, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.input");
          const issues = r.error.data.issues ?? [];
          expect(issues.length).toBeGreaterThan(0);
          for (const i of issues) expect(i.path[0]).toBe(part);
        }
        expect(sent).toBe(0);
      }),
      { seed: 1337 },
    );
  });
});
