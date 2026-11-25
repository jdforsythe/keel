// Examples: contract and manifest validation codes (E1502-E1515 at run time) and the routes.json artifact.
import { action, guard, manifest, routeTable, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";

const view = (): Node => document.createComment("");
const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "thrown";
  }
};
const P = s.object({ id: s.id("X") });

describe("contract validation", () => {
  it("E1502 for two pages at one path pattern", () => {
    expect(
      codeOf(() =>
        contract("v1", {
          "v1.a": { path: "/v1/:id", params: P },
          "v1.b": { path: "/v1/:other", params: s.object({ other: s.string() }) },
        }),
      ),
    ).toBe("E1502");
  });

  it("E1503 for a path param with no params schema", () => {
    expect(codeOf(() => contract("v2", { "v2.a": { path: "/v2/:id" } }))).toBe("E1503");
  });

  it("E1503 for a params schema naming no path param", () => {
    expect(codeOf(() => contract("v3", { "v3.a": { path: "/v3", params: P } }))).toBe("E1503");
  });

  it("E1504 for a search schema with a required field", () => {
    expect(codeOf(() => contract("v4", { "v4.a": { path: "/v4", search: s.object({ q: s.string() }) } }))).toBe(
      "E1504",
    );
  });

  it("E1510 for a layout carrying a path", () => {
    // The type error is in negativeTypes.test-d.ts; called untyped here.
    expect(codeOf(() => Reflect.apply(contract, undefined, ["v12", { "v12.l": { layout: true, path: "/l" } }]))).toBe(
      "E1510",
    );
  });

  it("clean counterpart: a valid contract does not throw", () => {
    expect(
      codeOf(() =>
        contract("ok", {
          "ok.shell": { layout: true },
          "ok.show": { path: "/ok/:id", params: P, search: s.object({ t: s.enum(["a"]).optional() }) },
        }),
      ),
    ).toBeUndefined();
  });
});

describe("manifest validation", () => {
  it("E1506 for a layout cycle", () => {
    const c = contract("v5", { "v5.l": { layout: true }, "v5.m": { layout: true } });
    expect(
      codeOf(() =>
        manifest(c, { "v5.l": { component: view, layout: "v5.m" }, "v5.m": { component: view, layout: "v5.l" } }),
      ),
    ).toBe("E1506");
  });

  it("E1506 for a layout that is a page", () => {
    const c = contract("v6", { "v6.l": { path: "/v6l" }, "v6.a": { path: "/v6" } });
    expect(
      codeOf(() =>
        Reflect.apply(manifest, undefined, [
          c,
          { "v6.l": { component: view }, "v6.a": { component: view, layout: "v6.l" } },
        ]),
      ),
    ).toBe("E1506");
  });

  it("E1506 for a layout id the contract lacks", () => {
    const c = contract("v8", { "v8.a": { path: "/v8" } });
    expect(
      codeOf(() => Reflect.apply(manifest, undefined, [c, { "v8.a": { component: view, layout: "v8.shell" } }])),
    ).toBe("E1506");
  });

  it("E1515 for an entry left unbound", () => {
    const c = contract("v7", { "v7.a": { path: "/v7" }, "v7.b": { path: "/v7b" } });
    expect(codeOf(() => Reflect.apply(manifest, undefined, [c, { "v7.a": { component: view } }]))).toBe("E1515");
  });

  it("E1515 for a key no entry has", () => {
    const c = contract("v9", { "v9.a": { path: "/v9" } });
    expect(
      codeOf(() =>
        Reflect.apply(manifest, undefined, [c, { "v9.a": { component: view }, "v9.extra": { component: view } }]),
      ),
    ).toBe("E1515");
  });

  it("a layout binding takes an errorElement", () => {
    const c = contract("v10", { "v10.l": { layout: true }, "v10.a": { path: "/v10" } });
    expect(
      codeOf(() => manifest(c, { "v10.l": { component: view, errorElement: view }, "v10.a": { component: view } })),
    ).toBeUndefined();
  });

  it("E1510 for a title on a layout", () => {
    const c = contract("v10t", { "v10t.l": { layout: true }, "v10t.a": { path: "/v10t" } });
    expect(
      codeOf(() =>
        Reflect.apply(manifest, undefined, [
          c,
          { "v10t.l": { component: view, title: () => "t" }, "v10t.a": { component: view } },
        ]),
      ),
    ).toBe("E1510");
  });

  it("E1510 for an action on a page's binding key it does not take", () => {
    const c = contract("v11", { "v11.a": { path: "/v11" } });
    const save = action(c, "v11.a", { input: s.object({}) }, async () => ok(null));
    expect(codeOf(() => Reflect.apply(manifest, undefined, [c, { "v11.a": { component: view, action: save } }]))).toBe(
      "E1510",
    );
  });

  it("E1508 for a page guard without redirect", () => {
    const c = contract("v13", { "v13.a": { path: "/v13" } });
    const open = guard({}, async () => ok(null));
    expect(codeOf(() => Reflect.apply(manifest, undefined, [c, { "v13.a": { component: view, guard: open } }]))).toBe(
      "E1508",
    );
  });

  it("unrelated manifests never interact: the same path and id in two contracts are both valid", () => {
    const make = () => manifest(contract("v14", { "v14.a": { path: "/v14" } }), { "v14.a": { component: view } });
    expect(codeOf(make)).toBeUndefined();
    expect(codeOf(make)).toBeUndefined();
  });
});

describe("routesArtifact", () => {
  it("lists every route with sorted keys, JSON Schema params and search, and null path for layouts", () => {
    const c = contract("art", {
      "art.shell": { layout: true },
      "art.login": { path: "/login" },
      "art.show": { path: "/art/:id", params: P, search: s.object({ tab: s.enum(["a", "b"]).optional() }) },
    });
    const save = action(c, "art.show", { input: s.object({ note: s.string() }) }, async () => ok(null));
    const routes = manifest(c, {
      "art.shell": { component: view },
      "art.login": { component: view },
      "art.show": {
        component: view,
        layout: "art.shell",
        guard: guard({ redirect: "art.login" }, async () => ok(null)),
        POST: save,
        DELETE: save,
      },
    });
    const a = routesArtifact(routes);
    expect(Object.keys(a)).toEqual(["art.login", "art.shell", "art.show"]);
    expect(a["art.shell"]).toEqual({
      actions: [],
      guard: null,
      layout: null,
      module: "art",
      params: null,
      path: null,
      search: null,
    });
    expect(a["art.show"]).toEqual({
      actions: ["DELETE", "POST"],
      guard: "art.login",
      layout: "art.shell",
      module: "art",
      params: {
        properties: { id: { minLength: 1, type: "string", "x-keel-id": "X" } },
        required: ["id"],
        type: "object",
      },
      path: "/art/:id",
      search: { properties: { tab: { enum: ["a", "b"], type: "string" } }, required: [], type: "object" },
    });
    expect(JSON.stringify(routesArtifact(routes))).toBe(JSON.stringify(a));
  });

  it("gives a page naming another module's layout as bound; serving that module alone is still E1506", () => {
    const frame = contract("frame", { "frame.main": { layout: true } });
    const shop = contract("shop", { "shop.home": { path: "/" } });
    const shopRoutes = manifest(shop, { "shop.home": { component: view, layout: "frame.main" } });
    expect(routesArtifact(shopRoutes)["shop.home"]?.layout).toBe("frame.main");
    expect(codeOf(() => routeTable(shopRoutes))).toBe("E1506");
    const joined = routeTable(manifest(frame, { "frame.main": { component: view } }), shopRoutes);
    expect(routesArtifact(joined)["shop.home"]?.layout).toBe("frame.main");
  });
});
