// @vitest-environment happy-dom
// @vitest-environment-options {"url": "about:blank"}
// On a page with an opaque origin (`about:blank`, `file:`, a sandboxed frame) the home page has no origin to upload
// to: it renders the ingest path, records without an upload, and never throws E2006 during its render. Seed 1337
import { createCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { mount } from "@keel/runtime-dom";
import { record, session } from "@keel/std-sessions";
import { describe, expect, it } from "vitest";
import Home from "../modules/ops/Home.ts";

describe("ops.home on an opaque page", () => {
  it("renders the path and records without uploading", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const dispose = mount(Home, document.body, { ctx });
    expect(document.body.textContent).toContain("/sessions");
    report(ctx, { kind: "error", error: { code: "ops.forced", message: "forced for the test", data: null } });
    await Promise.resolve();
    expect(
      record(ctx)
        .errors()
        .map((e) => e.code),
    ).toEqual(["ops.forced"]);
    expect(session(ctx).taken()).toEqual([]);
    dispose();
    record(ctx).stop();
  });
});
