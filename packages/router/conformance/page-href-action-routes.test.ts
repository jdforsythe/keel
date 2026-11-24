// @vitest-environment happy-dom
// Spec: k.router#19, clause "Over `t` as above, under `createRouter(t, { ctx, history })` a `Form` submit to `shop.list` runs `a` with `routes` `t` itself (`===`); `a.run(input, args, ctx)` with no `routes` in `args` gives `fn` a route table on which `pageHref(routes, '/list')` is `err` `keel.notFound`."
// Spec: k.server, clause "`action(contract, id, { input?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, user, stores, routes }` and `ctx`, `routes` the route table it is served from (k.router Return targets); returns `Result<Href | null, KeelError>` on a page (an API entry's `output` on one: k.api); the binding places it (k.contract)."
// Spec: k.server, clause "A loader's `run(args, ctx)` and an action's `run(input, args, ctx)` call `fn` directly, outside a request (tests). `args.url` is the absolute request URL as a string. `args.stores` is optional: absent, `fn` gets the value the declared factory returns for `ctx` (Server state), `undefined` without one; `run` saves nothing. An action's `args.routes` is optional: absent, `fn` gets `routeTable()`, a table with no pages."
// Seed 1337 (fc.assert below). `run` is reached with Reflect so the file type-checks before `run` exists on `action`'s value.
// Assumes `createRouter(routes, { ctx, history })` and `Form` as in fixtures.ts; the Form renders on `shop.list` and the submit is the DOM `submit` event.
import { createCtx } from "@keel/ctx";
import { Form, action, createRouter, manifest } from "@keel/router";
import type { RouteTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { pageHref } from "@keel/router/match";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { memoryHistory, settle, submit } from "./fixtures.ts";

const SEED = 1337;
const shop = contract("shop", {
  "shop.list": { path: "/list", search: s.object({ tab: s.enum(["a", "b"]).optional() }) },
  "shop.item": { path: "/items/:id", params: s.object({ id: s.int({ min: 1 }) }) },
});

const seen: unknown[] = [];
const a = action(shop, "shop.list", { input: s.object({}) }, async (_input, { routes }) => {
  seen.push(routes);
  return ok(null);
});
const ListPage = (): Node =>
  Form({ method: "POST", action: shop.href("shop.list"), children: () => [document.createElement("button")] });
const t = manifest(shop, {
  "shop.list": { component: ListPage, POST: a },
  "shop.item": { component: () => document.createElement("div") },
});

const runOf = (handler: unknown): ((...x: unknown[]) => Promise<unknown>) => {
  const fn: unknown =
    typeof handler === "object" || typeof handler === "function" ? Reflect.get(handler ?? {}, "run") : undefined;
  if (typeof fn !== "function") throw new Error("run is not a function");
  return async (...x) => Reflect.apply(fn, handler, x);
};
const args = { params: {}, search: {}, url: new URL("http://localhost/list"), caller: "c" };
const ctx = createCtx({ mode: "sim", seed: SEED });
const isTable = (v: unknown): v is RouteTable => typeof v === "object" && v !== null;

describe("k.router#19 an action's args carry `routes`", () => {
  it("under `createRouter(t, { ctx, history })` a `Form` submit to `shop.list` runs `a` with `routes` `t` itself (`===`)", async () => {
    seen.length = 0;
    const history = memoryHistory("/list");
    const router = createRouter(t, { ctx, history });
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = mount(router.App, host, { ctx });
    await settle();
    await submit(host);
    unmount();
    router.dispose();
    host.remove();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(t);
  });

  it("`a.run(input, args, ctx)` with no `routes` in `args` gives `fn` a route table on which `pageHref(routes, '/list')` is `err` `keel.notFound`", async () => {
    seen.length = 0;
    await runOf(a)({}, args, ctx);
    expect(seen).toHaveLength(1);
    const routes = seen[0];
    expect(isTable(routes)).toBe(true);
    if (!isTable(routes)) return;
    const r = pageHref(routes, "/list");
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.error.code).toBe("keel.notFound");
  });

  it("`run` without `routes` refuses every read: any generated page href is `err` `keel.notFound`, message `not a page`", async () => {
    seen.length = 0;
    await runOf(a)({}, args, ctx);
    const routes = seen[0];
    if (!isTable(routes)) throw new Error("no route table");
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom("a" as const, "b" as const).map((tab) => shop.href("shop.list", {}, { tab })),
          fc.integer({ min: 1, max: 1_000_000 }).map((id) => shop.href("shop.item", { id })),
          fc.string(),
        ),
        (x) => {
          const r = pageHref(routes, x);
          expect(r.ok).toBe(false);
          expect(r.ok ? null : { code: r.error.code, message: r.error.message, data: r.error.data }).toEqual({
            code: "keel.notFound",
            message: "not a page",
            data: null,
          });
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("`run` with `routes` in `args` gives `fn` that table itself (`===`)", async () => {
    seen.length = 0;
    await runOf(a)({}, { ...args, routes: t }, ctx);
    expect(seen[0]).toBe(t);
    expect(pageHref(t, "/list")).toEqual({ ok: true, value: "/list" });
  });
});
