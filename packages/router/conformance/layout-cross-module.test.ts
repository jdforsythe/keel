// @vitest-environment happy-dom
// Spec: k.routes, Layouts "Another module's id compiles; `routeTable`, or a manifest served alone, throws E1506 naming both ids if it names no layout entry of the table or closes a cycle."
// Spec: k.routes, Layouts "An id of the own module that is no layout of the contract, or one not `<module>.<name>`, is a type error and `manifest` throws E1506"
// Seed 1337 (no random input: fixed modules).
// Compile-time half of each "does not compile" claim: ../unsafe/conformanceNegativeTypes.ts; the calls here are untyped.
import { type RouteProps, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { describe, expect, it } from "vitest";
import { page, settle, startRouter, thrown } from "./contract-support.ts";

const wrap = (tag: string) => (p: RouteProps) => {
  const e = document.createElement("div");
  e.setAttribute("data-layout", tag);
  if (p.children !== undefined) e.append(p.children());
  return e;
};

const shell = contract("shell", { "shell.frame": { layout: true }, "shell.home": { path: "/" } });
const shellModule = manifest(shell, {
  "shell.frame": { component: wrap("frame") },
  "shell.home": { component: page },
});
const app = contract("app", { "app.page": { path: "/p" }, "app.other": { path: "/o" } });
const appWith = (layout: `shell.${string}`) =>
  manifest(app, {
    "app.page": { component: page, layout },
    "app.other": { component: page },
  });

describe("k.routes: a layout of another module's contract", () => {
  it("a page bound with a layout of another module renders inside that layout's component once the tables are joined", async () => {
    const routes = routeTable(shellModule, appWith("shell.frame"));
    const { router, ctx } = startRouter(routes, "/p");
    const host = document.createElement("div");
    document.body.append(host);
    const { mount } = await import("@keel/runtime-dom");
    const stop = mount(router.App, host, { ctx });
    await settle();
    const frame = host.querySelector('[data-layout="frame"]');
    expect(frame?.querySelector("section")).not.toBeNull();
    stop();
    router.dispose();
  });

  it("a foreign layout id that names no entry of the table is E1506 at `routeTable`, naming both ids", () => {
    const e = thrown(() => routeTable(shellModule, appWith("shell.ghost")));
    expect(e?.code).toBe("E1506");
    expect(e?.message).toContain("app.page");
    expect(e?.message).toContain("shell.ghost");
  });

  it("a foreign layout id that names a page is E1506 at `routeTable`, naming both ids", () => {
    const e = thrown(() => routeTable(shellModule, appWith("shell.home")));
    expect(e?.code).toBe("E1506");
    expect(e?.message).toContain("app.page");
    expect(e?.message).toContain("shell.home");
  });

  it("a foreign layout id of a module not in the table is E1506 at `routeTable`", () => {
    const e = thrown(() => routeTable(appWith("shell.frame")));
    expect(e?.code).toBe("E1506");
  });

  it("layouts of two modules naming each other close a cycle that is E1506 at `routeTable`, naming both ids", () => {
    const ca = contract("ca", { "ca.frame": { layout: true } });
    const cb = contract("cb", { "cb.frame": { layout: true } });
    const ma = manifest(ca, { "ca.frame": { component: wrap("a"), layout: "cb.frame" } });
    const mb = manifest(cb, { "cb.frame": { component: wrap("b"), layout: "ca.frame" } });
    const e = thrown(() => routeTable(ma, mb));
    expect(e?.code).toBe("E1506");
    expect(e?.message).toContain("ca.frame");
    expect(e?.message).toContain("cb.frame");
  });

  it("a typo within the own module's prefix does not compile and `manifest` throws E1506", () => {
    const bad = () =>
      Reflect.apply(manifest, undefined, [
        app,
        { "app.page": { component: page, layout: "app.frmae" }, "app.other": { component: page } },
      ]);
    expect(thrown(bad)?.code).toBe("E1506");
  });
});
