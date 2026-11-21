// k.services Encoding: a path param `''`, `.` or `..` is `api.input` at `params.<name>` and nothing is sent; every
// other value is one percent-encoded segment, and the URL signed is the URL sent. A response body over `maxBytes`
// is `api.decode`; a base service follows no redirect. Seed 1337.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { endpoints } from "../src/endpoints.ts";
import { service } from "../src/service.ts";

const BASE = "https://api.example.com";
const schema = endpoints({
  get: { method: "GET", path: "/v1/:a/x/:b", params: s.object({ a: s.string(), b: s.string() }), output: s.json() },
});
const api = service({ base: BASE, schema });

const run = async (a: string, b: string) => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const sent: string[] = [];
  ctx.net.route(`${BASE}/*`, async (req) => {
    sent.push(req.url);
    return new Response("{}", { status: 200 });
  });
  return { r: await api.get({ params: { a, b } }, ctx), sent };
};

describe("path params", () => {
  it("`''`, `.` and `..` are api.input at their param and send nothing", async () => {
    for (const bad of ["", ".", ".."]) {
      const { r, sent } = await run(bad, "ok");
      expect(sent).toEqual([]);
      expect(r.ok ? null : [r.error.code, r.error.data]).toEqual([
        "api.input",
        { issues: [{ path: ["params", "a"], rule: "format" }] },
      ]);
    }
  });

  it("for generated values, each other param is one segment decoding to itself, at the path the endpoint names", async () => {
    const piece = fc.oneof(fc.fullUnicodeString(), fc.constantFrom("", ".", "..", "/", "\\", "a/../b", "%2e", "?#"));
    await fc.assert(
      fc.asyncProperty(piece, piece, async (a, b) => {
        const { r, sent } = await run(a, b);
        const refused = [a, b].some((v) => v === "" || v === "." || v === "..");
        if (refused) {
          expect([r.ok, sent]).toEqual([false, []]);
          return;
        }
        expect(sent).toHaveLength(1);
        const url = new URL(sent[0] ?? "");
        expect(url.origin).toBe(BASE);
        const [, v1, sa, x, sb, ...rest] = url.pathname.split("/");
        expect([v1, x, rest]).toEqual(["v1", "x", []]);
        expect([decodeURIComponent(sa ?? ""), decodeURIComponent(sb ?? "")]).toEqual([a, b]);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});

describe("the response", () => {
  const big = (n: number) => JSON.stringify("x".repeat(n));
  const answer = async (body: string, opts: { maxBytes?: number } = {}) => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(`${BASE}/*`, async () => new Response(body, { status: 200 }));
    return service({ base: BASE, schema, ...opts }).get({ params: { a: "a", b: "b" } }, ctx);
  };

  it("a body over the default 1 MiB is api.decode; one within it decodes", async () => {
    const over = await answer(big(1024 * 1024));
    expect(over.ok ? null : over.error.code).toBe("api.decode");
    expect((await answer(big(1024))).ok).toBe(true);
  });

  it("`maxBytes` sets the cap: a body one byte over it is api.decode, at it decodes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 4096 }), async (n) => {
        const body = big(n - 2);
        expect((await answer(body, { maxBytes: n })).ok).toBe(true);
        const over = await answer(body, { maxBytes: n - 1 });
        expect(over.ok ? null : over.error.code).toBe("api.decode");
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("`maxBytes` that is not a positive integer throws at construction", () => {
    for (const bad of [0, -1, 1.5, Number.NaN])
      expect(() => service({ base: BASE, schema, maxBytes: bad })).toThrow(RangeError);
  });

  it("a base service sends `redirect: manual`: a 3xx is api.status, not followed", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const modes: string[] = [];
    ctx.net.route(`${BASE}/*`, async (req) => {
      modes.push(req.redirect);
      return new Response(null, { status: 302, headers: { location: "https://evil.example/" } });
    });
    const r = await api.get({ params: { a: "a", b: "b" } }, ctx);
    expect(r.ok ? null : [r.error.code, r.error.data]).toEqual(["api.status", { status: 302, body: null }]);
    expect(modes).toEqual(["manual"]);
  });
});
