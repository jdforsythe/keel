import { createCtx } from "@keel/ctx";
// Examples: manifest validation codes (E1502-E1506 at runtime) and the routes.json artifact.
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { guard } from "../src/guard.ts";
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
const save = { kind: "keel.action" as const, input: s.object({}), run: async () => ok(null) };

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

  it("E1505 for actions in an entry, a routes.actions key that is not a verb, a layout or unknown id, or a second attach", () => {
    const routes = { "v7.a": { path: "/v7", component: view, actions: { GET: {} } } };
    expect(codeOf(() => Reflect.apply(manifest, undefined, [routes]))).toBe("E1505");
    const m = manifest({ "v7.l": { component: view }, "v7.b": { path: "/v7b", component: view } });
    const attach = (arg: unknown) => codeOf(() => Reflect.apply(m.actions, m, [arg]));
    expect(attach({ "v7.b": { GET: save } })).toBe("E1505");
    expect(attach({ "v7.l": { POST: save } })).toBe("E1505");
    expect(attach({ "v7.none": { POST: save } })).toBe("E1505");
    expect(attach({ "v7.b": { POST: save } })).toBeUndefined();
    expect(attach({ "v7.b": { PUT: save } })).toBe("E1505");
  });

  it("E1505 for an action value that is undefined, a plain object or a string; nothing attaches (backlog 0191)", () => {
    const m = manifest({ "v11.a": { path: "/v11", component: view }, "v11.b": { path: "/v11b", component: view } });
    const attach = (arg: unknown) => codeOf(() => Reflect.apply(m.actions, m, [arg]));
    expect(attach({ "v11.b": { POST: save }, "v11.a": { POST: undefined } })).toBe("E1505");
    expect(attach({ "v11.a": { POST: {} } })).toBe("E1505");
    expect(attach({ "v11.a": { POST: "save" } })).toBe("E1505");
    const noInput = { kind: "keel.action", run: () => ok(null) };
    expect(attach({ "v11.a": { POST: noInput } })).toBe("E1505");
    expect(attach({ "v11.a": { POST: new Proxy(noInput, {}) } })).toBe("E1505");
    expect(attach({ "v11.b": { POST: save } })).toBeUndefined();
    expect(attach({ "v11.a": { POST: save } })).toBeUndefined();
  });

  it("E1505 for routes.actions after createRouter compiled the entries (backlog 0183)", () => {
    const m = manifest({ "v10.a": { path: "/v10", component: view } });
    const router = createRouter(m, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/v10") });
    expect(codeOf(() => m.actions({ "v10.a": { POST: save } }))).toBe("E1505");
    router.dispose();
  });

  it("E1506 for a layout name not in the same manifest (manifests never share entries)", () => {
    manifest({ "v8.shell": { component: view } });
    expect(codeOf(() => manifest({ "v8.a": { path: "/v8", component: view, layout: "v8.shell" } }))).toBe("E1506");
  });

  it("unrelated manifests never interact: the same path and id in two manifests are both valid", () => {
    expect(codeOf(() => manifest({ "v9.a": { path: "/v9", component: view } }))).toBeUndefined();
    expect(codeOf(() => manifest({ "v9.a": { path: "/v9", component: view } }))).toBeUndefined();
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
      "art.login": { path: "/login", component: view },
      "art.show": {
        path: "/art/:id",
        params: P,
        search: s.object({ tab: s.enum(["a", "b"]).optional() }),
        component: view,
        layout: "art.shell",
        guard: guard({ redirect: "art.login" }, async () => ok(null)),
      },
    });
    routes.actions({ "art.show": { POST: save, DELETE: save } });
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
});
