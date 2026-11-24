// @vitest-environment node
// Spec: k.router#20, clause "Over `t` as above, `createApp({ routes: t, ctx, identity })` runs `a` on a POST to `/list` with `routes` `===` `t`. With `identity` `identity({ identify: async () => '', handle: { path: '/auth', fn } })`, a POST to `/auth/in` calls `fn(request, ctx, { routes })` with `routes` `===` `t`. A `fn` answering 303 with `location` the `ok` value of `pageHref(routes, next)` (`next` the request's `next` search value, `''` without one), else `'/list'`, answers `location: /items/7` for `/auth/in?next=%2Fitems%2F7`, and `location: /list` for `/auth/in?next=%2F%09%2Fevil.example`, `/auth/in?next=https%3A%2F%2Fevil.example`, `/auth/in?next=%2Fsignin` and `/auth/in`."
// Spec: k.server, clause "`action(contract, id, { input?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, user, stores, routes }` and `ctx`, `routes` the route table it is served from (k.router Return targets); returns `Result<Href | null, KeelError>` on a page (an API entry's `output` on one: k.api); the binding places it (k.contract)."
// Spec: k.user, clause "`handle: { path, fn }`: a request at `path` or under it goes to `fn(request, ctx, { routes })` with its body (`maxBodyBytes`), `routes` the deployable's route table, so a `next` it carries becomes a 303 `location` through `pageHref` (k.router Return targets), after the same-site check for a write; its `Response`, `set-cookie` included, is returned with k.security's headers added. An auth library's endpoints live here."
// Seed 1337 (fc.assert below). Runs under plain Node: happy-dom strips cookie headers. The table `t` is the spec's, over module `shop`.
// Assumes `createApp({ topology, routes, ctx, identity, mode, secret })` as in identity-support.ts; the `fn` below answers 303 as the clause describes.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import type { RouteTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { matchHref, pageHref } from "@keel/router/match";
import { ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const BASE = "http://localhost";
const SECRET = "conformance-secret-user-0123456789abcdef0123456789abcdef";
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

const Out = s.object({ n: s.int() });
const shop = contract("shop", {
  "shop.list": { path: "/list", search: s.object({ tab: s.enum(["a", "b"]).optional() }) },
  "shop.item": { path: "/items/:id", params: s.object({ id: s.int({ min: 1 }) }) },
  "shop.signin": { path: "/signin", search: s.object({ next: s.string().optional() }) },
  "shop.items": { method: "GET", path: "/api/items", output: Out },
});
const view = (): Node => document.createElement("p");
const gotRoutes: unknown[] = [];
const a = action(shop, "shop.list", { input: s.object({}) }, async (_input, { routes }) => {
  gotRoutes.push(routes);
  return ok(null);
});
const g = guard({ redirect: "shop.signin" }, async () => ok(null));
const t = manifest(shop, {
  "shop.list": { component: view, POST: a },
  "shop.item": { component: view, guard: g },
  "shop.signin": { component: view },
  "shop.items": { loader: loader(shop, "shop.items", {}, async () => ok({ n: 1 })) },
});

const handled: unknown[] = [];
async function start() {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const fn = async (request: Request, _ctx: Ctx, third: { routes: RouteTable }): Promise<Response> => {
    handled.push(third.routes);
    const next = new URL(request.url).searchParams.get("next") ?? "";
    const r = pageHref(third.routes, next);
    return new Response(null, { status: 303, headers: { location: r.ok ? r.value : "/list" } });
  };
  return createApp({
    topology: topology({ web: { modules: ["shop"], adapter: "node" } }),
    routes: t,
    ctx,
    mode: "production",
    secret: SECRET,
    identity: identity({ identify: async () => "", handle: { path: "/auth", fn } }),
  });
}

const location = async (app: Awaited<ReturnType<typeof start>>, next: string | null): Promise<string | null> => {
  const q = next === null ? "" : `?next=${encodeURIComponent(next)}`;
  const res = await app.fetch(
    new Request(`${BASE}/auth/in${q}`, { method: "POST", body: "", headers: { origin: BASE } }),
  );
  expect(res.status).toBe(303);
  return res.headers.get("location");
};

describe("k.router#20 the server hands `routes` to an action and to `handle.fn`", () => {
  test("`createApp({ routes: t, ctx, identity })` runs `a` on a POST to `/list` with `routes` `===` `t`", async () => {
    gotRoutes.length = 0;
    const app = await start();
    const res = await app.fetch(
      new Request(`${BASE}/list`, {
        method: "POST",
        body: "{}",
        headers: { accept: "application/json", "content-type": "application/json", origin: BASE },
      }),
    );
    expect(res.status).toBe(200);
    expect(gotRoutes).toHaveLength(1);
    expect(gotRoutes[0]).toBe(t);
  });

  test("a POST to `/auth/in` calls `fn(request, ctx, { routes })` with `routes` `===` `t`", async () => {
    handled.length = 0;
    const app = await start();
    await location(app, null);
    expect(handled).toHaveLength(1);
    expect(handled[0]).toBe(t);
  });

  test("a `fn` answering 303 through `pageHref(routes, next)` answers `location: /items/7` for `/auth/in?next=%2Fitems%2F7`", async () => {
    const app = await start();
    expect(await location(app, "/items/7")).toBe("/items/7");
  });

  test("`location: /list` for `/auth/in?next=%2F%09%2Fevil.example`, `/auth/in?next=https%3A%2F%2Fevil.example`, `/auth/in?next=%2Fsignin` and `/auth/in`", async () => {
    const app = await start();
    for (const next of ["/\t/evil.example", "https://evil.example", "/signin"])
      expect(await location(app, next)).toBe("/list");
    const bare = await app.fetch(
      new Request(`${BASE}/auth/in`, { method: "POST", body: "", headers: { origin: BASE } }),
    );
    expect(bare.status).toBe(303);
    expect(bare.headers.get("location")).toBe("/list");
  });

  test("for any `next`, `location` is `/list` or a page of `t` that is not the guard's redirect page, never a backslash, control character, `//` start or scheme", async () => {
    const app = await start();
    const piece = fc.constantFrom(
      "/",
      "//",
      "\\",
      "%2F",
      "%5C",
      "..",
      "%2e",
      "?",
      "#",
      "list",
      "items",
      "7",
      "signin",
      "\t",
      "https:",
      "evil.example",
    );
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ maxLength: 40 }),
          fc.array(piece, { maxLength: 8 }).map((p) => `/${p.join("")}`),
          fc.constantFrom("/list", "/items/7", "/list?tab=b#top", "/api/items", "/signin"),
        ),
        async (next) => {
          const loc = await location(app, next);
          expect(loc).not.toBeNull();
          if (loc === null || loc === "/list") return;
          expect(loc.startsWith("/") && !loc.startsWith("//")).toBe(true);
          expect(loc.includes("\\")).toBe(false);
          expect(CONTROL.test(loc)).toBe(false);
          expect(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(loc)).toBe(false);
          const again = pageHref(t, loc);
          expect(again.ok).toBe(true);
          const id = again.ok ? matchHref(t, again.value)?.id : null;
          expect(id === "shop.list" || id === "shop.item").toBe(true);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
