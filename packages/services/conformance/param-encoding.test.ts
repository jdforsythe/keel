import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
// Spec: k.services, clause "Param value `a/b` is sent as `a%2Fb`."
// k.services, Encoding "Path params are URL-encoded, one segment each (`''`, `.` or `..` is `api.input` at the param, nothing sent)"
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

  it("a backslash in a param is sent encoded as `%5C`", async () => {
    expect(await seen("a\\b")).toBe(`${BASE}/orders/a%5Cb`);
  });

  it("path params are URL-encoded, one segment each, for any value but '', '.' and '..' (decodeURIComponent of the segment round-trips)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((v) => v !== "." && v !== ".."),
        async (id) => {
          const url = await seen(id);
          expect(url.startsWith(`${BASE}/orders/`)).toBe(true);
          const segment = url.slice(`${BASE}/orders/`.length);
          expect(segment).not.toContain("/");
          expect(decodeURIComponent(segment)).toBe(id);
        },
      ),
      { seed: 1337 },
    );
  });

  it("a param of '', '.' or '..' is `api.input` at the param, with rule `format`, and nothing is sent", async () => {
    for (const id of ["", ".", ".."]) {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      let sent = 0;
      ctx.net.route(`${BASE}/*`, async () => {
        sent++;
        return new Response("{}", { status: 200 });
      });
      const r = await api.get({ params: { id } }, ctx);
      expect(r.ok, JSON.stringify(id)).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("api.input");
        const issues = r.error.code === "api.input" ? r.error.data.issues : [];
        expect(issues.length).toBeGreaterThan(0);
        for (const i of issues) {
          expect(i.path.slice(0, 2)).toEqual(["params", "id"]);
          expect(i.rule).toBe("format");
        }
      }
      expect(sent, JSON.stringify(id)).toBe(0);
    }
  });
});
