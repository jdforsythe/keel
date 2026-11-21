// @vitest-environment happy-dom
// A layout of another module (k.contract Binding, k.routes Layouts): a page of `ap` binds `al`'s layout; `manifest`
// checks its own ids and the foreign id's form, `routeTable` resolves the reference across the union (E1506).
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { describe, expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { compileRoutes } from "../src/internal/compileRoutes.ts";
import { manifest } from "../src/manifest.ts";
import { matchHref } from "../src/match/matchHref.ts";
import { routeTable } from "../src/routeTable.ts";
import type { RouteProps } from "../src/types/RouteProps.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const shell =
  (name: string) =>
  (p: RouteProps): Node => {
    const e = document.createElement("div");
    e.setAttribute("data-x", name);
    if (p.children !== undefined) e.append(p.children());
    return e;
  };
const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "thrown";
  }
};
const messageOf = (fn: () => unknown): string => {
  try {
    fn();
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : "thrown";
  }
};

const al = contract("al", { "al.layout": { layout: true }, "al.home": { path: "/al" } });
const shellRoutes = manifest(al, { "al.layout": { component: shell("al") }, "al.home": { component: shell("home") } });
const ap = contract("ap", { "ap.inner": { layout: true }, "ap.page": { path: "/ap" } });
const pageRoutes = manifest(ap, {
  "ap.inner": { component: shell("inner"), layout: "al.layout" },
  "ap.page": { component: shell("page"), layout: "ap.inner" },
});

describe("a layout of another module", () => {
  it("renders the chain across modules, outermost first", async () => {
    const routes = routeTable(shellRoutes, pageRoutes);
    const chain = compileRoutes(routes)
      .located.find((r) => r.id === "ap.page")
      ?.chain.map((l) => l.id);
    expect(chain).toEqual(["al.layout", "ap.inner", "ap.page"]);
    expect(routeTable(pageRoutes, shellRoutes)).toBeDefined();
    const ctx = createCtx({ mode: "sim", seed: 7 });
    const router = createRouter(routes, { ctx, history: memoryHistory("/ap") });
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = mount(router.App, host, { ctx });
    await settle();
    expect(host.querySelector('[data-x="al"] > [data-x="inner"] > [data-x="page"]')).not.toBeNull();
    unmount();
    router.dispose();
    host.remove();
  });

  it("manifest takes the foreign id; served alone, the table throws E1506 naming both ids", () => {
    expect(pageRoutes.contracts).toEqual([ap]);
    expect(messageOf(() => compileRoutes(pageRoutes))).toBe(
      'E1506 ap.inner: layout "al.layout" names no entry of the route table',
    );
    expect(codeOf(() => matchHref(pageRoutes, "/ap"))).toBe("E1506");
    expect(codeOf(() => routeTable(pageRoutes))).toBe("E1506");
  });

  it("E1506 at routeTable for an unknown foreign layout", () => {
    const b = contract("b", { "b.page": { path: "/b" } });
    const routes = manifest(b, { "b.page": { component: shell("b"), layout: "al.nope" } });
    expect(messageOf(() => routeTable(shellRoutes, routes))).toBe(
      'E1506 b.page: layout "al.nope" names no entry of the route table',
    );
  });

  it("E1506 at routeTable for a foreign id naming a page", () => {
    const b = contract("b", { "b.page": { path: "/b" } });
    const routes = manifest(b, { "b.page": { component: shell("b"), layout: "al.home" } });
    expect(messageOf(() => routeTable(shellRoutes, routes))).toBe(
      'E1506 b.page: layout "al.home" is a page entry, no layout',
    );
  });

  it("E1506 at routeTable for a cycle across modules", () => {
    const x = contract("x", { "x.l": { layout: true }, "x.p": { path: "/x" } });
    const y = contract("y", { "y.l": { layout: true } });
    const xr = manifest(x, {
      "x.l": { component: shell("x"), layout: "y.l" },
      "x.p": { component: shell("p"), layout: "x.l" },
    });
    const yr = manifest(y, { "y.l": { component: shell("y"), layout: "x.l" } });
    expect(messageOf(() => routeTable(xr, yr))).toBe("E1506 x.l: layout cycle x.l in y.l in x.l");
  });

  it("manifest checks what it sees: an own id the contract lacks and an id with no module are E1506", () => {
    // Untyped, as a caller the types did not stop: the run-time check alone.
    const own = (layout: string) => () =>
      Reflect.apply(manifest, undefined, [
        ap,
        { "ap.inner": { component: shell("i") }, "ap.page": { component: shell("p"), layout } },
      ]);
    expect(codeOf(own("ap.layuot"))).toBe("E1506");
    expect(codeOf(own("ap.page"))).toBe("E1506");
    expect(codeOf(own("layout"))).toBe("E1506");
    expect(codeOf(own("al."))).toBe("E1506");
    expect(codeOf(own("al.layout"))).toBeUndefined();
  });

  it("types: own ids exact, a foreign id by its module prefix", () => {
    const view = shell("v");
    manifest(ap, {
      "ap.inner": { component: view, layout: "al.layout" },
      "ap.page": { component: view, layout: "ap.inner" },
    });
    manifest(ap, {
      "ap.inner": { component: view, layout: "a.layout" },
      "ap.page": { component: view, layout: "apx.shell" },
    });
    // The refusals (a typo within the own prefix, an own page as layout) are in unsafe/negativeTypes.ts; the
    // run-time checks are in `manifest checks what it sees` above.
  });
});
