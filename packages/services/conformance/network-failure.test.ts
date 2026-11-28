import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { contract } from "@keel/router/contract";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
// Spec: k.services, clause "A rejected `fetch`, or a 502 `keel.unreachable` err to a `contract` service, yields `api.network`; to a `base` service, `api.status`."
// k.services, ApiError "`api.network` `{}`: `fetch` rejected, or a `contract` service got a 502 JSON `keel.unreachable` err of at most 1 KiB."
// seed 1337 (fast-check runs below pass { seed: 1337 }); no wall clock, no Math.random.
// ASSUMPTION (public API not visible from index.ts): sim net is `ctx.net.route(url, handler)` where the
// handler receives a request with `url`/`signal` and returns a standard Response; sim clock has `advance(ms)`.
// ASSUMPTION: a k.server `err` is JSON `{ ok: false, error: { code, message, data } }`.
const BASE = "https://api.example.com";
const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};

const MODULE_URL = "http://b.keel.invalid";
const bContract = contract("b", { "b.get": { method: "GET", path: "/x", output: s.object({}) } });
type Failure = { ok: boolean; error: { code: string; data: unknown } };
const moduleService = () => service({ contract: bContract });
const call = async (api: unknown, ctx: unknown): Promise<Failure> => {
  const get: unknown = typeof api === "object" && api !== null ? Reflect.get(api, "get") : undefined;
  if (typeof get !== "function") throw new Error("client has no get");
  return Reflect.apply(get, api, [{}, ctx]);
};
const unreachable = (message: string): Response =>
  new Response(JSON.stringify({ ok: false, error: { code: "keel.unreachable", message, data: {} } }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });

describe("k.services: network failure", () => {
  it("A rejected `fetch`, or a 502 `keel.unreachable` err to a `contract` service, yields `api.network`: a rejected fetch", async () => {
    const api = service({
      base: BASE,
      schema: endpoints({ get: { method: "GET", path: "/x", output: s.object({}) } }),
    });
    await fc.assert(
      fc.asyncProperty(fc.string(), async (msg) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/x`, () => Promise.reject(new Error(msg)));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe("api.network");
      }),
      { seed: 1337 },
    );
  });

  it("a 502 `keel.unreachable` err to a `contract` service yields `api.network`", async () => {
    const api = moduleService();
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 200 }), async (message) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${MODULE_URL}/x`, () => unreachable(message));
        const r = await call(api, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe("api.network");
      }),
      { seed: 1337 },
    );
  });

  it("a 502 `keel.unreachable` err to a `base` service yields `api.status` with status 502", async () => {
    const api = service({
      base: BASE,
      schema: endpoints({ get: { method: "GET", path: "/x", output: s.object({}) } }),
    });
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 200 }), async (message) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/x`, () => unreachable(message));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.status");
          expect(r.error.data).toMatchObject({ status: 502 });
        }
      }),
      { seed: 1337 },
    );
  });

  it("a 502 `keel.unreachable` err to a `base` service with `errors[502]` declared yields `api.status` whose body is the decoded value", async () => {
    const api = service({
      base: BASE,
      schema: endpoints({
        get: { method: "GET", path: "/x", output: s.object({}), errors: { 502: s.object({ ok: s.literal(false) }) } },
      }),
    });
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 200 }), async (message) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${BASE}/x`, () => unreachable(message));
        const r = await api.get({}, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.status");
          expect(r.error.data).toMatchObject({ status: 502, body: { ok: false } });
        }
      }),
      { seed: 1337 },
    );
  });

  it("a 502 `keel.unreachable` err of more than 1 KiB to a `contract` service is not mapped to `api.network`", async () => {
    const api = moduleService();
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1025, max: 4000 }), async (len) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        ctx.net.route(`${MODULE_URL}/x`, () => unreachable("m".repeat(len)));
        const r = await call(api, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).not.toBe("api.network");
      }),
      { seed: 1337, numRuns: 25 },
    );
  });
});
