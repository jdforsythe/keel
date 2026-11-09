// @vitest-environment happy-dom
// @vitest-environment-options {"url": "http://localhost/"}
// The ops home page resumes in a browser with a page origin: it starts a session recording on the page's ctx whose
// upload is this service's own `/sessions`. A forced error event shows the upload target. The recorder outlives the
// page component, and an error reported after the served route but before the page resumes still reaches it, as on
// first load. Seed 1337
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { mount } from "@keel/runtime-dom";
import { record, session } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import Home from "../modules/ops/Home.ts";
import { routes } from "../modules/ops/routes.ts";

const served = (ctx: Ctx): void =>
  report(ctx, { kind: "nav", href: "/", route: { id: "ops.home", path: "/", params: {}, search: {}, schemas: {} } });
const forced = (ctx: Ctx): void =>
  report(ctx, { kind: "error", error: { code: "ops.forced", message: "forced for the test", data: null } });

describe("ops.home recording", () => {
  it("records on the page ctx and uploads the first error to the page origin + /sessions", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    await renderRoute("ops.home", { routes, ctx });

    const recorder = record(ctx);
    expect(recorder.errors()).toEqual([]);
    expect(session(ctx).taken()).toEqual([]);

    report(ctx, { kind: "error", error: { code: "ops.forced", message: "forced for the test", data: null } });
    await Promise.resolve();
    expect(recorder.errors().map((e) => e.code)).toEqual(["ops.forced"]);
    expect(recorder.events().map((e) => e.kind)).toEqual(["error"]);

    const taken = session(ctx).taken();
    expect(taken).toHaveLength(1);
    expect(taken[0]?.url.href).toBe("http://localhost/sessions");
    expect(taken[0]?.session.error?.code).toBe("ops.forced");
  });

  it("uploads an error reported after the served route and before the home page resumes", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    served(ctx);
    forced(ctx);
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
    served(ctx);
    const dispose = mount(Home, document.body, { ctx });
    dispose();
    forced(ctx);
    await Promise.resolve();
    expect(
      record(ctx)
        .errors()
        .map((e) => e.code),
    ).toEqual(["ops.forced"]);
    expect(session(ctx).taken()).toHaveLength(1);
    record(ctx).stop();
  });
});
