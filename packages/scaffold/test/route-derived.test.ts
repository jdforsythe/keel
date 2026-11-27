// Spec: k.scaffold Generators `route`: without `path` the path is `/` and the id's segments after the module in kebab
// case; a derived path another route holds is E1351 naming `--path`; a loader when a `node` deployable lists the module
// or `loader` asks for one, none otherwise; `loader` with `no-loader` or `api` is E1052.
import { scaffold } from "@keel/scaffold";
import { describe, expect, it } from "vitest";
import { apply } from "./helpers.ts";

const project = (adapter: string) => apply("project", { name: "shop", adapter, workspace: false }, new Map());

describe("scaffold route: the path from the id", () => {
  it("app.about binds /about, orders.orderHistory /order-history, a deeper id each segment", () => {
    const f = apply("route", { id: "app.about" }, project("client"));
    expect(f.get("modules/app/app.contract.ts")).toContain(`path: "/about"`);
    const g = apply("route", { id: "app.orderHistory" }, project("client"));
    expect(g.get("modules/app/app.contract.ts")).toContain(`path: "/order-history"`);
    const h = apply("route", { id: "app.list.recent" }, project("client"));
    expect(h.get("modules/app/app.contract.ts")).toContain(`path: "/list/recent"`);
  });

  it("a derived path another route holds is E1351 naming --path", () => {
    const f = apply("route", { id: "app.reach", path: "/contact" }, project("client"));
    const r = scaffold("route", { id: "app.contact" }, f);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.data.code).toBe("E1351");
    expect(r.error.data.message).toContain("--path <path>");
  });

  it("a given path that clashes names no --path", () => {
    const f = apply("route", { id: "app.a", path: "/a" }, project("client"));
    const r = scaffold("route", { id: "app.b", path: "/a" }, f);
    expect(r.ok ? "" : r.error.data.message).not.toContain("--path");
  });
});

describe("scaffold route: the loader follows the deployable", () => {
  it("client and static: no server file unless loader asks", () => {
    for (const adapter of ["client", "static"]) {
      const f = apply("route", { id: "app.about" }, project(adapter));
      expect([...f.keys()].filter((p) => p.endsWith(".server.ts"))).toEqual([]);
      expect(f.get("modules/app/routes.ts")).not.toContain("loadAbout");
    }
    const asked = apply("route", { id: "app.about", loader: true }, project("client"));
    expect(asked.has("modules/app/loadAbout.server.ts")).toBe(true);
  });

  it("node: a loader by default, none with no-loader", () => {
    expect(apply("route", { id: "app.about" }, project("node")).has("modules/app/loadAbout.server.ts")).toBe(true);
    const bare = apply("route", { id: "app.about", "no-loader": true }, project("node"));
    expect(bare.has("modules/app/loadAbout.server.ts")).toBe(false);
  });

  it("loader with no-loader, or loader with api, is E1052", () => {
    for (const input of [
      { id: "app.about", loader: true, "no-loader": true },
      { id: "app.about", loader: true, api: true },
    ]) {
      const r = scaffold("route", input, project("node"));
      expect(r.ok ? "" : r.error.data.code).toBe("E1052");
    }
  });

  it("an API route keeps its handler wherever it runs", () => {
    const f = apply("route", { id: "app.items", api: true }, project("client"));
    expect(f.has("modules/app/loadItems.server.ts")).toBe(true);
  });
});

describe("badInput: a missing field is named", () => {
  it("route with no id carries missing: id", () => {
    const r = scaffold("route", {}, project("client"));
    expect(r.ok ? undefined : r.error.data.missing).toBe("id");
  });
});
