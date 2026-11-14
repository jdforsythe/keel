// @vitest-environment happy-dom
// k.testing Harness: `renderRoute(id, { url })` starts from a raw path and query, parsed as a navigation parses it;
// `location()` is `{ entries, scrollY }`: a search-only `replace` leaves both, a push adds one entry.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { findRouter } from "@keel/router/internal";
import type { RouterCore } from "@keel/router/internal";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";

const cores: (RouterCore | null)[] = [];
const routes = manifest({
  "loc.list": {
    path: "/loc",
    search: s.object({ page: s.int().optional(), sort: s.enum(["name", "date"]).optional() }),
    component: (p) => {
      cores.push(findRouter());
      const main = document.createElement("main");
      const h = document.createElement("h1");
      h.textContent = `page ${JSON.stringify(p.search)}`;
      main.append(h);
      return main;
    },
  },
  "loc.other": {
    path: "/other",
    component: () => {
      const main = document.createElement("main");
      const h = document.createElement("h1");
      h.textContent = "other";
      main.append(h);
      return main;
    },
  },
});
const ctx = () => createCtx({ mode: "sim", seed: 1337 });
const core = (): RouterCore => {
  const c = cores.at(-1);
  if (c === null || c === undefined) throw new Error("no router");
  return c;
};

describe("renderRoute url and location()", () => {
  it("a raw url's search is parsed as navigation parses it: failing keys dropped", async () => {
    const t = await renderRoute("loc.list", { routes, url: "/loc?page=3&sort=bogus&x=1", ctx: ctx() });
    expect(t.route()).toMatchObject({ id: "loc.list", search: { page: 3 } });
    expect(t.route().search).not.toHaveProperty("sort");
    t.dispose();
  });

  it("a search-only replace leaves entries and scrollY; a push adds one entry", async () => {
    const t = await renderRoute("loc.list", { routes, ctx: ctx() });
    window.scrollTo(0, 240);
    const before = t.location();
    expect(before).toEqual({ entries: 1, scrollY: 240 });
    void core().navigate(routes.href("loc.list", {}, { page: 2 }), { replace: true });
    await t.settle();
    expect(t.route()).toMatchObject({ search: { page: 2 } });
    expect(t.location()).toEqual(before);
    await t.navigate(routes.href("loc.other"));
    expect(t.location()).toEqual({ entries: 2, scrollY: 0 });
    t.dispose();
  });
});
