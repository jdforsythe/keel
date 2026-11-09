// @vitest-environment happy-dom
// @vitest-environment-options {"url": "http://localhost/"}
// The ops home page resumes in a browser with a page origin: it starts a session recording on the page's ctx whose
// upload is this service's own `/sessions`. A forced error event shows the upload target. Seed 1337
import { createCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { record, session } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { routes } from "../modules/ops/routes.ts";

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
});
