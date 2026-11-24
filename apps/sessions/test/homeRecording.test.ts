// @vitest-environment happy-dom
// @vitest-environment-options {"url": "http://localhost/"}
// The ops home page resumes in a browser with a page origin: it starts a session recording on the page's ctx whose
// upload is this service's own `/sessions`. Each page is served by the `sessions` deployable's app (`node`), over the
// page's ctx. A loader that fails with `ops.forced` reports the navigation and then the loader's error. The recorder
// outlives the page component, and an error reported after the served route but before the page resumes still reaches
// it, as on first load. Seed 1337
import { createCtx } from "@keel/ctx";
import { loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { err, s } from "@keel/schema";
import { createApp } from "@keel/server";
import { record, session } from "@keel/std-sessions";
import { routes as sessionsRoutes } from "@keel/std-sessions/routes";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import Home from "../modules/ops/Home.ts";
import { routes } from "../modules/ops/routes.ts";
import topology from "../topology.ts";

const forced = contract("ops", { "ops.home": { path: "/" }, "ops.forced": { path: "/forced" } });
const failingContract = contract("ops", { "ops.home": { path: "/" } });

/** A loader that always fails with `ops.forced`: the router reports it as an `error` event after its `nav`. */
const fail = () => err({ code: "ops.forced", message: "forced for the test", data: null });

/** The ops home page beside a route whose loader fails. */
const withForced = manifest(forced, {
  "ops.home": { component: Home },
  "ops.forced": { component: Home, loader: loader(forced, "ops.forced", { output: s.string() }, async () => fail()) },
});

/** `ops.home` served with a loader that fails: the router reports its `nav`, then the loader's `error`. */
const failing = manifest(failingContract, {
  "ops.home": {
    component: Home,
    loader: loader(failingContract, "ops.home", { output: s.string() }, async () => fail()),
  },
});

/** The `sessions` deployable (`node`) serving `table` beside the ingest routes, over `ctx`. */
const serve = (table: typeof routes, ctx: ReturnType<typeof createCtx>) =>
  createApp({ topology, deployable: "sessions", routes: routeTable(table, sessionsRoutes), ctx });

describe("ops.home recording", () => {
  it("records on the page ctx and uploads the first error to the page origin + /sessions", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const page = await renderRoute("ops.home", { routes: withForced, ctx, app: await serve(withForced, ctx) });

    const recorder = record(ctx);
    expect(recorder.errors()).toEqual([]);
    expect(session(ctx).taken()).toEqual([]);

    await page.navigate(forced.href("ops.forced"));
    expect(recorder.errors().map((e) => e.code)).toEqual(["ops.forced"]);
    expect(recorder.events().map((e) => e.kind)).toEqual(["nav", "error"]);

    const taken = session(ctx).taken();
    expect(taken).toHaveLength(1);
    expect(taken[0]?.url.href).toBe("http://localhost/sessions");
    expect(taken[0]?.session.error?.code).toBe("ops.forced");
    page.dispose();
    recorder.stop();
  });

  it("uploads an error reported after the served route and before the home page resumes", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const served = await renderRoute("ops.home", { routes: failing, ctx, app: await serve(failing, ctx) });
    served.dispose();
    expect(session(ctx).taken()).toEqual([]);
    const dispose = mount(Home, document.body, { ctx });
    await Promise.resolve();
    const taken = session(ctx).taken();
    expect(taken).toHaveLength(1);
    expect(taken[0]?.session.route.id).toBe("ops.home");
    expect(taken[0]?.session.error?.code).toBe("ops.forced");
    dispose();
    record(ctx).stop();
  });

  it("keeps recording after the home page is disposed", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const page = await renderRoute("ops.home", { routes, ctx, app: await serve(routes, ctx) });
    page.dispose();
    const next = await renderRoute("ops.home", { routes: failing, ctx, app: await serve(failing, ctx) });
    // The recorder the first page started is the one that sees the second page's navigation.
    expect(
      record(ctx)
        .events()
        .map((e) => e.kind),
    ).toEqual(["nav"]);
    next.dispose();
    record(ctx).stop();
  });
});
