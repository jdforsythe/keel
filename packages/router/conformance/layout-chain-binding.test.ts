// @vitest-environment happy-dom
// Spec: k.routes, Layouts "A page or layout binding names the layout it renders in with `layout`, a layout id of its contract or of another module's, so a chain nests to any depth, outermost first"
// Spec: k.routes, Conformance "A page bound with `layout: 'a.inner'`, `a.inner` with `layout: 'a.outer'`, renders inside `a.inner`'s component, inside `a.outer`'s."
// Spec: k.routes, Conformance "A `layout` naming a page id does not compile and `manifest` throws E1506; two layouts naming each other make `manifest` throw E1506 naming both."
// Seed 1337 (no random input: fixed chains).
// Compile-time half of each "does not compile" claim: ./negative-types.test-d.ts; the calls here are untyped.
import { type RouteProps, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { describe, expect, it } from "vitest";
import { codeOf, page, settle, startRouter, thrown } from "./contract-support.ts";

const wrap = (tag: string) => (p: RouteProps) => {
  const e = document.createElement("div");
  e.setAttribute("data-layout", tag);
  if (p.children !== undefined) e.append(p.children());
  return e;
};

const c = contract("a", {
  "a.outer": { layout: true },
  "a.inner": { layout: true },
  "a.page": { path: "/p" },
  "a.other": { path: "/o" },
});

describe("k.routes: layout chains in the binding", () => {
  it("a page bound with `layout: 'a.inner'`, `a.inner` with `layout: 'a.outer'`, renders inside `a.inner`'s component, inside `a.outer`'s", async () => {
    const routes = manifest(c, {
      "a.outer": { component: wrap("outer") },
      "a.inner": { component: wrap("inner"), layout: "a.outer" },
      "a.page": { component: page, layout: "a.inner" },
      "a.other": { component: page },
    });
    const { router, ctx } = startRouter(routes, "/p");
    const host = document.createElement("div");
    document.body.append(host);
    const { mount } = await import("@keel/runtime-dom");
    const stop = mount(router.App, host, { ctx });
    await settle();
    const outer = host.querySelector('[data-layout="outer"]');
    const inner = outer?.querySelector('[data-layout="inner"]');
    expect(inner?.querySelector("section")).not.toBeNull();
    stop();
    router.dispose();
  });

  it("a `layout` naming a page id does not compile and `manifest` throws E1506", () => {
    const bad = () =>
      Reflect.apply(manifest, undefined, [
        c,
        {
          "a.outer": { component: page },
          "a.inner": { component: page },
          "a.page": { component: page, layout: "a.other" },
          "a.other": { component: page },
        },
      ]);
    expect(codeOf(bad)).toBe("E1506");
  });

  it("a `layout` naming an id the contract lacks does not compile and `manifest` throws E1506", () => {
    const bad = () =>
      Reflect.apply(manifest, undefined, [
        c,
        {
          "a.outer": { component: page },
          "a.inner": { component: page },
          "a.page": { component: page, layout: "a.nope" },
          "a.other": { component: page },
        },
      ]);
    expect(codeOf(bad)).toBe("E1506");
  });

  it("two layouts naming each other make `manifest` throw E1506 naming both ids", () => {
    const x = contract("a", { "a.x": { layout: true }, "a.y": { layout: true } });
    const e = thrown(() =>
      manifest(x, {
        "a.x": { component: wrap("x"), layout: "a.y" },
        "a.y": { component: wrap("y"), layout: "a.x" },
      }),
    );
    expect(e?.code).toBe("E1506");
    expect(e?.message).toContain("a.x");
    expect(e?.message).toContain("a.y");
  });

  it("a layout no binding names is no error", () => {
    const ok = () =>
      manifest(c, {
        "a.outer": { component: wrap("outer") },
        "a.inner": { component: wrap("inner") },
        "a.page": { component: page },
        "a.other": { component: page },
      });
    expect(codeOf(ok)).toBeNull();
  });
});

function bindingWith(over: Record<string, unknown>) {
  return {
    "a.outer": { component: wrap("outer") },
    "a.inner": { component: wrap("inner") },
    "a.page": { component: page },
    "a.other": { component: page },
    ...over,
  };
}
