// @vitest-environment happy-dom
// Spec: k.runtime, clause "After resume of a page whose loader failed, an observer gets the served `nav`, then its `error` with only `code` and `data.at`."
// Seed 1337
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { resume } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";

const ROUTE = { id: "shop.item", path: "/item/:id", href: "/item/7", params: { id: "7" }, search: {} };
const ERROR = { code: "shop.missing", message: "shop.missing", data: { at: "shop.item" } };

function run(error?: unknown): CtxEvent[] {
  const state = { stores: {}, islands: {}, route: ROUTE, ...(error === undefined ? {} : { error }) };
  document.body.innerHTML = `<script type="application/json" id="k-state">${JSON.stringify(state)}</script>`;
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  resume(document.body, {}, { ctx });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  document.body.innerHTML = "";
  return events;
}

describe("k.runtime: after resume of a page whose loader failed, an observer gets the served nav, then its error with only code and data.at", () => {
  it("an observer gets the served `nav`, then its `error`", () => {
    const events = run(ERROR);
    expect(events.map((e) => e.kind)).toEqual(["nav", "error"]);
    expect(events[0]).toMatchObject({ kind: "nav", href: "/item/7", route: { id: "shop.item" } });
  });

  it("the error carries code, data deep-equal to { at }, and a message equal to the code", () => {
    const e = run(ERROR)[1];
    if (e === undefined || e.kind !== "error") throw new Error("expected an error event");
    expect(e.error.code).toBe("shop.missing");
    expect(e.error.data).toEqual({ at: "shop.item" });
    expect(e.error.message).toBe("shop.missing");
  });

  it("with no `error` in `#k-state` only the nav arrives", () => {
    expect(run().map((e) => e.kind)).toEqual(["nav"]);
  });

  it("an `error` value of the wrong shape reports no error", () => {
    expect(run("shop.missing").map((e) => e.kind)).toEqual(["nav"]);
  });
});
