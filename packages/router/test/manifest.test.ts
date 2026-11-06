import { createCtx } from "@keel/ctx";
// Examples: manifest validation codes (E1502-E1506 at runtime) and the routes.json artifact.
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { manifest } from "../src/manifest.ts";
import { routesArtifact } from "../src/routesArtifact.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";
import { memoryHistory } from "./memoryHistory.ts";

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

describe("manifest validation", () => {
  it.each<[string, Record<string, RouteDef>]>([
    [
      "E1502",
      {
        "v1.a": { path: "/v1/:id", params: P, component: view },
        "v1.b": { path: "/v1/:other", params: s.object({ other: s.string() }), component: view },
      },
    ],
    ["E1503", { "v2.a": { path: "/v2/:id", component: view } }],
    ["E1503", { "v3.a": { path: "/v3", params: P, component: view } }],
    ["E1504", { "v4.a": { path: "/v4", search: s.object({ q: s.string() }), component: view } }],
    ["E1506", { "v5.l": { component: view, layout: "v5.m" }, "v5.m": { component: view, layout: "v5.l" } }],
    ["E1506", { "v6.l": { path: "/v6l", component: view }, "v6.a": { path: "/v6", component: view, layout: "v6.l" } }],
  ])("%s fixture throws its code", (code, routes) => {
    expect(codeOf(() => manifest(routes))).toBe(code);
  });

  it("E1505 for an actions key that is not a verb", () => {
    const routes = { "v7.a": { path: "/v7", component: view, actions: { GET: {} } } };
    expect(codeOf(() => Reflect.apply(manifest, undefined, [routes]))).toBe("E1505");
  });

  it("E1506 for an unknown layout, at createRouter", () => {
    const routes = manifest({ "v8.a": { path: "/v8", component: view, layout: "v8.nope" } });
    const ctx = createCtx({ mode: "sim" });
    expect(codeOf(() => createRouter(routes, { ctx, history: memoryHistory("/v8") }))).toBe("E1506");
  });

  it("clean counterpart: a valid manifest does not throw", () => {
    expect(
      codeOf(() =>
        manifest({
          "ok.shell": { component: view },
          "ok.show": {
            path: "/ok/:id",
            params: P,
            search: s.object({ t: s.enum(["a"]).optional() }),
            component: view,
            layout: "ok.shell",
          },
        }),
      ),
    ).toBeUndefined();
  });
});

describe("routesArtifact", () => {
  it("lists every route with sorted keys, JSON Schema params and search, and null path for layouts", () => {
    const save = {
      kind: "keel.action" as const,
      input: s.object({ note: s.string() }),
      run: async () => ({ ok: true as const, value: null }),
    };
    const routes = manifest({
      "art.shell": { component: view },
      "art.show": {
        path: "/art/:id",
        params: P,
        search: s.object({ tab: s.enum(["a", "b"]).optional() }),
        actions: { POST: save, DELETE: save },
        component: view,
        layout: "art.shell",
        guard: "auth",
      },
    });
    const a = routesArtifact(routes);
    expect(Object.keys(a)).toEqual(["art.shell", "art.show"]);
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
      guard: "auth",
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
});
