// @vitest-environment happy-dom
// @vitest-environment-options {"url": "about:blank"}
// On a page with an opaque origin (`about:blank`, `file:`, a sandboxed frame) the home page has no origin to upload
// to: it renders the ingest path, records without an upload, and never throws E2006 during its render. A component
// that throws, mounted on the same ctx, raises the error event: the root Boundary reports `keel.unexpected`. Seed 1337
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { record, session } from "@keel/std-sessions";
import { describe, expect, it } from "vitest";
import Home from "../modules/ops/Home.ts";

/** A component whose render throws. */
function Broken(): Node {
  throw new Error("forced for the test");
}

describe("ops.home on an opaque page", () => {
  it("renders the path and records without uploading", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const dispose = mount(Home, document.body, { ctx });
    expect(document.body.textContent).toContain("/sessions");
    const host = document.createElement("div");
    document.body.append(host);
    const caught: string[] = [];
    const disposeBroken = mount(Broken, host, { ctx, onError: (e) => caught.push(e.code) });
    await Promise.resolve();
    expect(caught).toEqual(["keel.unexpected"]);
    expect(
      record(ctx)
        .errors()
        .map((e) => e.code),
    ).toEqual(["keel.unexpected"]);
    expect(session(ctx).taken()).toEqual([]);
    disposeBroken();
    dispose();
    record(ctx).stop();
  });
});
