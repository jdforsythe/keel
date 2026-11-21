// @vitest-environment happy-dom
// Spec: k.guards, clause "A guard returning `err` redirects to its `redirect` route with `next` and the matched route's same-name params (one missing: E1508); no loader or route component runs." (rfc:0079) Seed 1337.
import { createCtx } from "@keel/ctx";
import { createRouter, guard, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { err, s } from "@keel/schema";
import { beforeEach, describe, expect, it } from "vitest";
import {
  SEED,
  appContract,
  control,
  count,
  idOf,
  log,
  memoryHistory,
  now,
  resetObservations,
  settle,
  start,
  total,
} from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

describe("k.guards", () => {
  beforeEach(resetObservations);
  it("a guard returning err redirects to its redirect route with next; no loader runs and the route component never renders", async () => {
    const app = await start("/", { render: true });
    control.gate = false;
    await app.router.navigate(appContract.href("app.secretShow", { id: idOf("5") }));
    await settle();
    expect(count("guard:auth")).toBe(1);
    expect(now(app.router)).toMatchObject({ id: "app.login", search: { next: expect.stringContaining("/secret/5") } });
    expect(app.history.current()).toContain("next=");
    expect(total("loader:")).toBe(0);
    expect(count("render:secret.show")).toBe(0);
    expect(app.host.querySelector('[data-page="secret.show"]')).toBeNull();
    expect(app.host.querySelector('[data-page="app.login"]')).not.toBeNull();
    app.stop();
  });
  it("a guard returning ok lets the route load and render (clean counterpart)", async () => {
    const app = await start("/", { render: true });
    await app.router.navigate(appContract.href("app.secretShow", { id: idOf("5") }));
    await settle();
    expect(now(app.router)).toMatchObject({ id: "app.secretShow" });
    expect(count("loader:secret.show")).toBe(1);
    expect(app.host.querySelector('[data-page="secret.show"]')).not.toBeNull();
    app.stop();
  });
  it("every guard in the chain runs, outermost first, before any loader", async () => {
    const app = await start("/", { render: true });
    log.length = 0;
    await app.router.navigate(appContract.href("app.guardedPage"));
    await settle();
    expect(log.filter((e) => e.startsWith("guard:") || e.startsWith("loader:"))).toEqual([
      "guard:g.outer",
      "guard:g.inner",
      "loader:guarded.page",
    ]);
    app.stop();
  });

  it("a guard redirect carries the matched route's same-name params", async () => {
    const Id = s.object({ id: s.string({ min: 1, max: 8 }) });
    const Denied = s.error("keel.denied", s.object({}));
    const page = (): Node => document.createElement("section");
    const wContract = contract("w", {
      "w.login": { path: "/login/:id", params: Id },
      "w.secret": { path: "/secret/:id", params: Id },
    });

    const r = manifest(wContract, {
      "w.login": { component: page },
      "w.secret": { component: page, guard: guard({ redirect: "w.login" }, async () => err(Denied.make({}))) },
    });
    const history = memoryHistory("/");
    const router = createRouter(r, { ctx: createCtx({ mode: "sim", seed: SEED }), history });
    const host = document.createElement("div");
    document.body.append(host);
    const off = mount(router.App, host, { ctx: simCtx });
    await settle();
    await router.navigate(wContract.href("w.secret", { id: "abc" }));
    await settle();
    expect(now(router)).toMatchObject({ id: "w.login", params: { id: "abc" } });
    off();
    router.dispose();
    host.remove();
  });
  it("a guard redirect to a route with a param the matched route lacks is E1508 (shown as in guard-redirect-loop-e1508.test.ts: with mode dev, an alert whose text contains E1508)", async () => {
    const Id = s.object({ id: s.string({ min: 1, max: 8 }) });
    const Denied = s.error("keel.denied", s.object({}));
    const page = (): Node => document.createElement("section");
    const w = contract("w", {
      "w.login": { path: "/login/:id", params: Id },
      "w.plain": { path: "/plain" },
    });

    const r = manifest(w, {
      "w.login": { component: page },
      "w.plain": { component: page, guard: guard({ redirect: "w.login" }, async () => err(Denied.make({}))) },
    });
    const router = createRouter(r, {
      ctx: createCtx({ mode: "sim", seed: SEED }),
      history: memoryHistory("/"),
      mode: "dev",
    });
    const host = document.createElement("div");
    document.body.append(host);
    const off = mount(router.App, host, { ctx: simCtx });
    await settle();
    await router.navigate(w.href("w.plain"));
    await settle();
    expect(host.querySelector('[role="alert"]')?.textContent ?? "").toContain("E1508");
    off();
    router.dispose();
    host.remove();
  });
  // Pending (rfc:0177): replaces the case above ("... is E1508 (shown as in guard-redirect-loop-e1508.test.ts ...") once the build lands,
  // since `manifest` then throws E1508 for the missing param when the table is built, not at the denial.
  it.skip("a guard redirect to a route with a param the matched route lacks makes `manifest` throw E1508 naming the page, the redirect route and the field", () => {
    const Id = s.object({ id: s.string({ min: 1, max: 8 }) });
    const Denied = s.error("keel.denied", s.object({}));
    const page = (): Node => document.createElement("section");
    const w = contract("w", {
      "w.login": { path: "/login/:id", params: Id },
      "w.plain": { path: "/plain" },
    });
    let thrown: unknown;
    try {
      manifest(w, {
        "w.login": { component: page },
        "w.plain": { component: page, guard: guard({ redirect: "w.login" }, async () => err(Denied.make({}))) },
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toMatchObject({ code: "E1508", message: expect.stringContaining("w.plain") });
    expect(thrown).toMatchObject({ message: expect.stringContaining("w.login") });
    expect(thrown).toMatchObject({ message: expect.stringContaining("id") });
  });
});
