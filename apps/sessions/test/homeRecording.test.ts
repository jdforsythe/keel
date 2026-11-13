// @vitest-environment happy-dom
// @vitest-environment-options {"url": "http://localhost/"}
// The ops home page resumes in a browser with a page origin: it starts a session recording on the page's ctx whose
// upload is this service's own `/sessions`. A loader that fails with `ops.forced` raises the error event through the
// router, which reports the navigation and then the loader's error. The recorder outlives the page component, and an
// error reported after the served route but before the page resumes still reaches it, as on first load. Seed 1337
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { record, session } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import Home from "../modules/ops/Home.ts";
import { routes } from "../modules/ops/routes.ts";
import { forcedLoader } from "./forcedLoader.server.ts";

/** The ops home page beside a route whose loader fails. */
const withForced = manifest({
  "ops.home": { path: "/", component: Home },
  "ops.forced": { path: "/forced", component: Home, loader: forcedLoader },
});

/** `ops.home` served with a loader that fails: the router reports its `nav`, then the loader's `error`. */
const failing = manifest({
  "ops.home": { path: "/", component: Home, loader: forcedLoader },
});

describe("ops.home recording", () => {
  it("records on the page ctx and uploads the first error to the page origin + /sessions", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const page = await renderRoute("ops.home", { routes: withForced, ctx });

    const recorder = record(ctx);
    expect(recorder.errors()).toEqual([]);
    expect(session(ctx).taken()).toEqual([]);

    await page.navigate(withForced.href("ops.forced"));
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
    const served = await renderRoute("ops.home", { routes: failing, ctx });
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
    const page = await renderRoute("ops.home", { routes, ctx });
    page.dispose();
    const forced = await renderRoute("ops.home", { routes: failing, ctx });
    expect(
      record(ctx)
        .errors()
        .map((e) => e.code),
    ).toEqual(["ops.forced"]);
    expect(session(ctx).taken()).toHaveLength(1);
    forced.dispose();
    record(ctx).stop();
  });
});
