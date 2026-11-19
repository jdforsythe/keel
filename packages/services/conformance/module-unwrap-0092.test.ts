// Spec: k.services Encoding, "a `module` service reads the route's `Result` (GET: `results[id]`, the matched route's own) and decodes its `ok` value with `output` and, on a non-2xx, its `error` with `errors[status]`."
// Spec: k.services Conformance, "A `module` GET endpoint whose `output` is the loader's `output` yields `ok(v)` for a loader `ok(v)`; a loader `err` `keel.notFound` yields `api.status` 404 with `body` the KeelError decoded by `errors[404]`."
// Spec: k.services API, "It follows no redirect: a 3xx is `api.status` (in a browser `status` 0, an opaque redirect)."
// Seed 1337 (fc.assert below). Sim net only; `module` is not in the visible `ServiceOptions`, so the service is built through Reflect.apply.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const URL_B = "http://b.keel.invalid";
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Out = {
  ok: boolean;
  value?: unknown;
  error?: { code: string; data: { status?: number; body?: unknown; issues?: unknown } };
};

const Box = s.object({ title: s.string(), n: s.int() });
const NotFound = s.object({ code: s.string(), message: s.string(), data: s.object({}) });
const schema = endpoints({
  show: {
    method: "GET",
    path: "/b/:id",
    params: s.object({ id: s.string() }),
    output: Box,
    errors: { 404: NotFound },
  },
  save: {
    method: "POST",
    path: "/b/:id",
    params: s.object({ id: s.string() }),
    body: s.object({ title: s.string() }),
    output: s.string().nullable(),
    errors: { 409: NotFound },
  },
});

const client = (): unknown => Reflect.apply(service, undefined, [{ module: "b", schema }]);
async function call(api: unknown, name: string, args: unknown, ctx: unknown): Promise<Out> {
  const m: unknown = typeof api === "object" && api !== null ? Reflect.get(api, name) : undefined;
  if (typeof m !== "function") throw new Error(`client has no ${name}`);
  return Reflect.apply(m, api, [args, ctx]);
}
const ROUTE = "b.show";
const getAnswer = (own: unknown, parent: unknown = { ok: true, value: "layout" }): unknown => ({
  id: ROUTE,
  results: { "b.layout": parent, [ROUTE]: own },
});

describe("k.services: a module service unwraps the route's Result", () => {
  it("A `module` GET endpoint whose `output` is the loader's `output` yields `ok(v)` for a loader `ok(v)`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,8}$/), fc.string(), fc.integer(), async (id, title, n) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${URL_B}/b/${id}`, () => json(getAnswer({ ok: true, value: { title, n } })));
        const r = await call(client(), "show", { params: { id } }, ctx);
        expect(r.ok).toBe(true);
        expect(r.value).toEqual({ title, n });
      }),
      { seed: 1337, numRuns: 25 },
    );
  });

  it("the GET answer's own level is read: parent levels' results are ignored", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), fc.string(), async (parent, title) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${URL_B}/b/x`, () => json(getAnswer({ ok: true, value: { title, n: 1 } }, parent)));
        const r = await call(client(), "show", { params: { id: "x" } }, ctx);
        expect(r.ok).toBe(true);
        expect(r.value).toEqual({ title, n: 1 });
      }),
      { seed: 1337, numRuns: 25 },
    );
  });

  it("a loader `err` `keel.notFound` yields `api.status` 404 with `body` the KeelError decoded by `errors[404]`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (message) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const error = { code: "keel.notFound", message, data: {} };
        ctx.net.route(`${URL_B}/b/x`, () => json(getAnswer({ ok: false, error }), 404));
        const r = await call(client(), "show", { params: { id: "x" } }, ctx);
        expect(r.ok).toBe(false);
        expect(r.error?.code).toBe("api.status");
        expect(r.error?.data.status).toBe(404);
        expect(r.error?.data.body).toEqual(error);
      }),
      { seed: 1337, numRuns: 25 },
    );
  });

  it("a non-2xx without a declared `errors[status]` is `api.status` with `body: null`", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const error = { code: "keel.unexpected", message: "unexpected", data: {} };
    ctx.net.route(`${URL_B}/b/x`, () => json(getAnswer({ ok: false, error }), 500));
    const r = await call(client(), "show", { params: { id: "x" } }, ctx);
    expect(r.error?.code).toBe("api.status");
    expect(r.error?.data.status).toBe(500);
    expect(r.error?.data.body).toBeNull();
  });

  it("an action's answer is the body itself: its `Result` `ok` value (`Href | null`) is decoded with `output`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.option(fc.stringMatching(/^\/[a-z]{0,8}$/), { nil: null }), async (href) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${URL_B}/b/x`, () => json({ ok: true, value: href }));
        const r = await call(client(), "save", { params: { id: "x" }, body: { title: "t" } }, ctx);
        expect(r.ok).toBe(true);
        expect(r.value).toBe(href);
      }),
      { seed: 1337, numRuns: 25 },
    );
  });

  it("an action `err` on a non-2xx is `api.status` with `body` decoded by `errors[status]`", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const error = { code: "keel.conflict", message: "m", data: {} };
    ctx.net.route(`${URL_B}/b/x`, () => json({ ok: false, error }, 409));
    const r = await call(client(), "save", { params: { id: "x" }, body: { title: "t" } }, ctx);
    expect(r.error?.code).toBe("api.status");
    expect(r.error?.data.status).toBe(409);
    expect(r.error?.data.body).toEqual(error);
  });

  it("a 2xx body of another shape, or an `ok` value failing `output`, is `api.decode`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom({ unrelated: 1 }, [], "text", 7, { ok: true, value: { title: 1, n: "x" } }),
        async (body) => {
          const ctx = createCtx({ mode: "sim", seed: 1337 });
          ctx.net.route(`${URL_B}/b/x`, () => json(body));
          const r = await call(client(), "show", { params: { id: "x" } }, ctx);
          expect(r.ok).toBe(false);
          expect(r.error?.code).toBe("api.decode");
        },
      ),
      { seed: 1337, numRuns: 10 },
    );
  });

  it("a `base` service is unchanged: a third-party body is what `output` describes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.integer(), async (title, n) => {
        const api = service({ base: "https://api.example.com", schema });
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route("https://api.example.com/b/x", () => json({ title, n }));
        const r = await api.show({ params: { id: "x" } }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toEqual({ title, n });
      }),
      { seed: 1337, numRuns: 25 },
    );
  });

  it("It follows no redirect: a 3xx is `api.status`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(301, 302, 303, 307, 308), async (status) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${URL_B}/b/x`, () => new Response(null, { status, headers: { location: "/elsewhere" } }));
        const r = await call(client(), "show", { params: { id: "x" } }, ctx);
        expect(r.ok).toBe(false);
        expect(r.error?.code).toBe("api.status");
        expect(r.error?.data.status).toBe(status);
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  it('in a browser an opaque redirect (`type: "opaqueredirect"`, `status: 0`) is `api.status` with `status` 0', async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    // A Response cannot be built with status 0; this stands in for what fetch gives a manual redirect.
    const opaque = new Response(null, { status: 200 });
    Object.defineProperty(opaque, "status", { value: 0 });
    Object.defineProperty(opaque, "type", { value: "opaqueredirect" });
    Object.defineProperty(opaque, "ok", { value: false });
    ctx.net.route(`${URL_B}/b/x`, () => opaque);
    const r = await call(client(), "show", { params: { id: "x" } }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("api.status");
    expect(r.error?.data.status).toBe(0);
  });
});
