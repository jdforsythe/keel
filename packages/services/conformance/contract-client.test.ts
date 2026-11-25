// Spec: k.contract, clause "`service({ contract: c })` has a method per API entry named by the id after the module, none for a page."
// Spec: k.services, clause "A `contract` GET entry yields `ok(v)` for its loader's `ok(v)`; a loader `err` `keel.notFound` yields `api.status` 404 with `body` the KeelError decoded by `errors[404]`." (packages/services/conformance/module-unwrap-0092.test.ts)
// k.services API, "`service({ contract, timeout? })` calls the API entries of the contract's module, one method per entry named by its id after the module."
// RFC 0157 Conformance diff: "a call's answer decodes the loader's `ok` value with the entry's `output`, and a 404 `keel.notFound` with `errors[404]`." Seed 1337.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";

const Box = s.object({ title: s.string() });
const NotFound = s.object({ code: s.string(), message: s.string(), data: s.object({}) });
const c = contract("kitchen", {
  "kitchen.shell": { layout: true },
  "kitchen.home": { path: "/kitchen" },
  "kitchen.box": { method: "GET", path: "/api/recipes", output: Box },
  "kitchen.add": { method: "POST", path: "/api/recipes", body: Box, output: s.object({}), errors: { 404: NotFound } },
  "kitchen.catalog": {
    method: "GET",
    path: "/api/catalog/:locale",
    params: s.object({ locale: s.string() }),
    query: s.object({ q: s.string() }),
    output: Box,
  },
});

describe("k.contract client", () => {
  it("`service({ contract: c })` has a method per API entry named by the id after the module, and none for a page or a layout", () => {
    const api = service({ contract: c });
    expect(Object.keys(api).sort()).toEqual(["add", "box", "catalog"]);
    expectTypeOf(api).toHaveProperty("box");
    expectTypeOf(api).toHaveProperty("add");
    expectTypeOf(api).toHaveProperty("catalog");
    // compile-time half: ./negative-types.test-d.ts
    expect(Reflect.get(api, "home")).toBeUndefined();
    expect(Reflect.get(api, "shell")).toBeUndefined();
  });

  it("a method's input is `{ params?, query?, body?, signal?, bearer?, user? }`: required exactly when the entry declares it", async () => {
    const api = service({ contract: c });
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(
      "*",
      () =>
        new Response(JSON.stringify({ ok: true, value: { title: "t" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    // compile-time half: ./negative-types.test-d.ts
    const missing = () => Reflect.apply(api.catalog, api, [{}, ctx]);
    expect(typeof missing).toBe("function");
    const extra = () => Reflect.apply(api.box, api, [{ body: { title: "x" } }, ctx]);
    expect(typeof extra).toBe("function");
  });

  it("a GET answer's loader `ok(v)` decodes with the entry's `output`, and the request goes to the module's origin plus the entry's path", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (title) => {
        const api = service({ contract: c });
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const seen: string[] = [];
        ctx.net.route("http://kitchen.keel.invalid/api/recipes", (req) => {
          seen.push(`${req.method} ${new URL(req.url).pathname}`);
          return new Response(
            JSON.stringify({ id: "kitchen.box", results: { "kitchen.box": { ok: true, value: { title } } } }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        });
        const r = await api.box({}, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toEqual({ title });
        expect(seen).toEqual(["GET /api/recipes"]);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("a 404 `keel.notFound` yields `api.status` 404 with `body` decoded by the entry's `errors[404]`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (message) => {
        const api = service({ contract: c });
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const error = { code: "keel.notFound", message, data: {} };
        ctx.net.route(
          "http://kitchen.keel.invalid/api/recipes",
          () =>
            new Response(JSON.stringify({ ok: false, error }), {
              status: 404,
              headers: { "content-type": "application/json" },
            }),
        );
        const r = await api.add({ body: { title: "x" } }, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.status");
          expect(r.error.data).toMatchObject({ status: 404, body: error });
        }
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("a call whose `query` fails the entry's schema is `api.input` and sends nothing (the client refuses a bad query before sending)", async () => {
    const api = service({ contract: c });
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    let sent = 0;
    ctx.net.route("*", () => {
      sent += 1;
      return new Response("{}", { status: 200 });
    });
    // compile-time half: ./negative-types.test-d.ts
    const r = await Reflect.apply(api.catalog, api, [{ params: { locale: "en" }, query: { q: 5 } }, ctx]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("api.input");
    expect(sent).toBe(0);
  });

  it("`service({ base, schema })` still takes `endpoints({...})` for a service no app module serves", async () => {
    const geo = service({
      base: "https://geo.example.com",
      schema: endpoints({
        lookup: { method: "GET", path: "/v1/:q", params: s.object({ q: s.string() }), output: Box },
      }),
    });
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(
      "https://geo.example.com/v1/x",
      () =>
        new Response(JSON.stringify({ title: "t" }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const r = await geo.lookup({ params: { q: "x" } }, ctx);
    expect(r.ok).toBe(true);
  });
});
