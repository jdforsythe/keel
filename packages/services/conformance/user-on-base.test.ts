// @vitest-environment happy-dom
// Spec: k.services, Conformance "A `base` call naming `user: 'u1'`, on a ctx a `createApp` bound and on one none bound, is `api.input` at `user` and sends nothing; under `renderRoute(id, { user: 'u1' })` a `base` call naming none carries no `x-keel-user`."
// Spec: k.services, API "`user` is k.user's, on a `contract` service only; a `base` service call naming it is `api.input` at `user` and sends nothing."
// Seed: 1337.
// Live: a `base` `user` is already `api.input`, and a `base` call under `renderRoute` already sends no `x-keel-user`.
// ASSUMPTION: `renderRoute(id, { routes, app, ctx, user })` as packages/services/conformance/render-route-user-support.ts uses it; a page loader's `ctx` is the app's bound ctx.
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, THIRD, client, record, simCtx } from "./third-party-support.ts";

const userArb = fc.stringMatching(/^[a-z][a-z0-9]{0,11}$/);
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);
const pathsOf = (issues: unknown): unknown[][] =>
  Array.isArray(issues)
    ? issues.flatMap((i: unknown) => {
        const p = field(i, "path");
        return Array.isArray(p) ? [p] : [];
      })
    : [];

const t = contract("t", { "t.page": { path: "/p" } });
const view = (): Node => {
  const main = document.createElement("main");
  main.textContent = "t";
  return main;
};
const bound = async (ctx = simCtx()) => {
  const routes = manifest(t, {
    "t.page": {
      component: view,
      loader: loader(t, "t.page", { output: s.object({}) }, async (_args, c) => {
        const r = await client().show({ params: { id: "1" } }, c);
        void r;
        return ok({});
      }),
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["t"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
    identity: identity({ identify: async () => "" }),
  });
  return { app, ctx, routes };
};

describe("k.services: `user` on a `base` call", () => {
  test("a `base` call naming `user` on a ctx no `createApp` bound is `api.input` at `user` and sends nothing", async () => {
    await fc.assert(
      fc.asyncProperty(userArb, async (user) => {
        const ctx = simCtx();
        const sent = record(ctx);
        const r = await client().show({ params: { id: "1" }, user }, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.input");
          expect(pathsOf(field(r.error.data, "issues")).some((p) => p[0] === "user")).toBe(true);
        }
        expect(sent).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("a `base` call naming `user` on a ctx a `createApp` bound is `api.input` at `user` and sends nothing", async () => {
    await fc.assert(
      fc.asyncProperty(userArb, async (user) => {
        const { ctx } = await bound();
        const sent = record(ctx);
        const r = await client().show({ params: { id: "1" }, user }, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("api.input");
          expect(pathsOf(field(r.error.data, "issues")).some((p) => p[0] === "user")).toBe(true);
        }
        expect(sent).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test("under `renderRoute(id, { user: 'u1' })` a `base` call naming none carries no `x-keel-user`", async () => {
    const { app, ctx, routes } = await bound();
    const sent = record(ctx, undefined, `${THIRD}/*`);
    document.documentElement.lang = "en";
    const h = await renderRoute("t.page", { routes, app, ctx, user: "u1" });
    try {
      await h.settle();
      const calls = sent.filter((r) => r.url.startsWith("https://api.example.com"));
      expect(calls.length).toBeGreaterThan(0);
      for (const r of calls) expect(r.names).not.toContain("x-keel-user");
    } finally {
      h.dispose();
    }
  });
});
