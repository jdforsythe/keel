// @vitest-environment happy-dom
// Spec: k.test-run Disposal "A route handle is disposed with every document it opened."
// Spec: k.test-run Conformance "A `renderRoute` with `app` whose `<Form>` submit is answered 303 leaves no element of either document after the test."
// Seed: 1337 (n/a: no generated inputs). The cases run in order. Lives in packages/server/conformance because `createApp` and the
// `f.page` fixture (render-route-document-support.ts) are this package's; `@keel/testing` does not depend on `@keel/server`.
// `renderRoute`'s `app` option is passed through a variable, as the neighbouring cases do.
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { appOn, reset, routes, simCtx } from "./render-route-document-support.ts";

const ids = ["f.root", "f.amount", "f.save", "f.doneText"];
let submitted = false;

describe("k.test-run: a route handle's documents", () => {
  it("a renderRoute with app whose Form submit is answered 303 holds two documents and is never disposed", async () => {
    reset("href");
    const ctx = simCtx();
    const app = await appOn(ctx);
    const opts = { routes, ctx, app };
    const h = await renderRoute("f.page", opts);
    expect(document.getElementById("f.root")).not.toBeNull();
    await h.fire("f.amount", { type: "input", value: "12" });
    await h.fire("f.save", { type: "click" });
    expect(h.documents().filter((d) => d.method === "POST")).toHaveLength(1);
    expect(document.getElementById("f.doneText")).not.toBeNull();
    submitted = true;
  });

  it("after that test no element of either document is in the document", () => {
    expect(submitted).toBe(true);
    for (const id of ids) expect(document.getElementById(id), id).toBeNull();
    expect(document.body.children.length).toBe(0);
  });
});
