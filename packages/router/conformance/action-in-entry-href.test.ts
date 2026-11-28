// @vitest-environment happy-dom
// Spec: k.contract, clause "A page action in its entry returning `ok(c.href('a.home'))` compiles unannotated; its document POST answers 303 to `/`." (the document POST: packages/server/conformance/contract-action-303.test.ts)
// RFC 0157 Conformance diff: "a POST to the page answers 303 to `/` (document) or `ok('/')` (runtime)." Spec: k.router "An action returning `ok(c.href(id))` compiles unannotated and navigates to `id`." Seed 1337.
// Spec: k.router, clause "An action returning `ok(c.href(id))` compiles unannotated and navigates to `id`."
import { Form, action, manifest, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { page, settle, startRouter } from "./contract-support.ts";

const Edit = s.object({ note: s.string() });
const c = contract("a", {
  "a.home": { path: "/" },
  "a.new": { path: "/new" },
});
let posted: unknown = null;
// no annotation anywhere: `fn`'s types come from the entry, and `c.href` needs no table that binds this action
const create = action(c, "a.new", { input: Edit }, (input) => {
  posted = input;
  return ok(c.href("a.home"));
});
const field = (): Node => {
  const input = document.createElement("input");
  input.setAttribute("name", "note");
  input.setAttribute("value", "n");
  return input;
};
const NewPage = (): Node => Form({ method: "POST", action: c.href("a.new"), children: () => [field()] });
const routes = manifest(c, {
  "a.home": { component: page },
  "a.new": { component: NewPage, POST: create },
});

describe("k.contract page action in its entry", () => {
  it("A page action in its entry returning `ok(c.href('a.home'))` compiles with no annotation; submitted inside the router it answers `ok('/')` and navigates to `a.home`", async () => {
    posted = null;
    const { router, ctx } = startRouter(routes, "/new");
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = mount(router.App, host, { ctx });
    await settle();
    expect(router.route.get().id).toBe("a.new");
    host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    expect(posted).not.toBeNull();
    expect(router.route.get().id).toBe("a.home");
    unmount();
    router.dispose();
    host.remove();
  });

  it("a page's bound verbs are its `routes.json` `actions`", () => {
    expect(routesArtifact(routes)["a.new"]?.actions).toEqual(["POST"]);
    expect(routesArtifact(routes)["a.home"]?.actions).toEqual([]);
  });
});
