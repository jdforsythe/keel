// @vitest-environment happy-dom
// A contract service over a real `createApp` (k.services, k.api Requests). The server answers a request part that fails
// with 422 `keel.fields`, its paths under `query.` for an API GET and `body.` for a write. The client yields
// `api.status` 422 with that error decoded by `errors[422]` when the entry declares it, else `body: null`. The client's
// contract is laxer than the server's (a client built against an older contract), so its own input check lets the
// request through and the server refuses it. Seed 1337; sim ctx.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { service } from "../src/service.ts";

const SEED = 1337;
const Fields = s.error("keel.fields", s.record(s.string()));
const N = s.object({ n: s.int() });
const strict = contract("fld", {
  "fld.find": { method: "GET", path: "/api/find", query: s.object({ q: s.string({ min: 2 }) }), output: N },
  "fld.add": { method: "POST", path: "/api/add", body: s.object({ note: s.string({ min: 2 }) }), output: N },
});
const lax = contract("fld", {
  "fld.find": {
    method: "GET",
    path: "/api/find",
    query: s.object({ q: s.string() }),
    output: N,
    errors: { 422: Fields },
  },
  "fld.add": {
    method: "POST",
    path: "/api/add",
    body: s.object({ note: s.string() }),
    output: N,
    errors: { 422: Fields },
  },
});
const bare = contract("fld", {
  "fld.add": { method: "POST", path: "/api/add", body: s.object({ note: s.string() }), output: N },
});
const three = async () => ok({ n: 3 });
const routes = manifest(strict, {
  "fld.find": { loader: loader(strict, "fld.find", {}, three) },
  "fld.add": { action: action(strict, "fld.add", {}, three) },
});

/** A ctx `createApp` bound, so a `fld` service call is answered in process by the app's `fetch`. */
const served = async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const app = await createApp({
    topology: topology({ web: { modules: ["fld"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { ctx, app };
};
const short = fc.string({ maxLength: 1 });
const sentBody = (r: { ok: boolean; error?: unknown }): unknown =>
  Reflect.get(Object(Reflect.get(Object(r.error), "data")), "body");
const keysOf = (e: unknown): string[] => Object.keys(Object(Reflect.get(Object(e), "data")));

describe("a server 422 through a contract service", () => {
  test("a GET's query refused by the server is api.status 422 with keel.fields at query.q", async () => {
    const { ctx, app } = await served();
    await fc.assert(
      fc.asyncProperty(short, async (q) => {
        const r = await service({ contract: lax }).find({ query: { q } }, ctx);
        expect(r).toMatchObject({ ok: false, error: { code: "api.status", data: { status: 422 } } });
        expect(sentBody(r)).toMatchObject({ code: "keel.fields" });
        expect(keysOf(sentBody(r))).toEqual(["query.q"]);
      }),
      { seed: SEED, numRuns: 5 },
    );
    expect(await service({ contract: lax }).find({ query: { q: "ok" } }, ctx)).toEqual({ ok: true, value: { n: 3 } });
    await app.close();
  });

  test("a write's body refused by the server is api.status 422 with keel.fields at body.note", async () => {
    const { ctx, app } = await served();
    await fc.assert(
      fc.asyncProperty(short, async (note) => {
        const r = await service({ contract: lax }).add({ body: { note } }, ctx);
        expect(r).toMatchObject({ ok: false, error: { code: "api.status", data: { status: 422 } } });
        expect(sentBody(r)).toMatchObject({ code: "keel.fields" });
        expect(keysOf(sentBody(r))).toEqual(["body.note"]);
      }),
      { seed: SEED, numRuns: 5 },
    );
    await app.close();
  });

  test("without errors[422] the same refusal is api.status 422 with body null", async () => {
    const { ctx, app } = await served();
    const r = await service({ contract: bare }).add({ body: { note: "x" } }, ctx);
    expect(r).toMatchObject({ ok: false, error: { code: "api.status", data: { status: 422, body: null } } });
    await app.close();
  });
});
