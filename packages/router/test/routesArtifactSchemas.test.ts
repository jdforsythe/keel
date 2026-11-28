// k.compiler Artifacts: `routes.json` gives each route's params and search as JSON Schema with sorted keys, for
// every kind of schema a search or query can hold, and lists a page's bound verbs and an API entry's method.
import type { s } from "@keel/schema";
import { blankPattern } from "@keel/schema/internal";
import { describe, expect, it, vi } from "vitest";

/** The `search` schema of the first case, built by the `s` of one evaluation of `@keel/schema`. */
const searchOf = (fs: typeof s) => {
  const Slug = fs.format("slug", fs.string({ min: 1 }), {
    check: (v) => /^[a-z-]+$/.test(v),
    gen: { from: fs.int({ min: 0, max: 9 }), map: (n) => `s-${"a".repeat(n)}` },
  });
  const Search = fs.object({
    slug: Slug.optional(),
    any: fs.json().optional(),
    closed: fs.object({ a: fs.int(), b: fs.boolean().optional() }, { closed: true }).optional(),
    open: fs.object({ z: fs.number(), a: fs.string() }).optional(),
    either: fs.union([fs.string({ max: 3 }), fs.int()]).optional(),
    tagged: fs
      .union("kind", [fs.object({ kind: fs.literal("a") }), fs.object({ kind: fs.literal("b"), n: fs.int() })])
      .optional(),
    list: fs.array(fs.literal(7)).optional(),
    map: fs.record(fs.boolean()).optional(),
    maybe: fs.string().nullable().optional(),
    token: fs.secret(fs.string({ min: 2 })).optional(),
  });
  return Search;
};
const expected = {
  properties: {
    any: {},
    closed: {
      additionalProperties: false,
      properties: { a: { type: "integer" }, b: { type: "boolean" } },
      required: ["a"],
      type: "object",
    },
    either: { anyOf: [{ maxLength: 3, minLength: 0, type: "string" }, { type: "integer" }] },
    list: { items: { const: 7 }, type: "array" },
    map: { additionalProperties: { type: "boolean" }, type: "object" },
    maybe: { anyOf: [{ minLength: 0, type: "string" }, { type: "null" }] },
    open: {
      properties: { a: { minLength: 0, type: "string" }, z: { type: "number" } },
      required: ["a", "z"],
      type: "object",
    },
    slug: { format: "slug", minLength: 1, pattern: blankPattern, type: "string" },
    tagged: {
      oneOf: [
        { properties: { kind: { const: "a" } }, required: ["kind"], type: "object" },
        { properties: { kind: { const: "b" }, n: { type: "integer" } }, required: ["kind", "n"], type: "object" },
      ],
    },
    token: { minLength: 2, pattern: blankPattern, type: "string" },
  },
  required: [],
  type: "object",
};

/** A component for a table that renders no page. */
const view = (): Node => {
  throw new Error("no page renders here");
};

describe("routesArtifact, the router loaded afresh", () => {
  it("writes each schema kind as JSON Schema, keys sorted at every level", async () => {
    vi.resetModules();
    const { s: fs } = await import("@keel/schema");
    const { contract } = await import("../src/contract/contract.ts");
    const { manifest } = await import("../src/manifest.ts");
    const { routesArtifact } = await import("../src/routesArtifact.ts");
    const c = contract("r", { "r.page": { path: "/r", search: searchOf(fs) } });
    const art = routesArtifact(manifest(c, { "r.page": { component: view } }));
    expect(art["r.page"]?.search).toEqual(expected);
    expect(JSON.stringify(art["r.page"]?.search)).toBe(JSON.stringify(expected));
    expect(art["r.page"]?.params).toBeNull();
  });

  it("lists a page's bound verbs sorted, and an API entry's api, method, query and action", async () => {
    vi.resetModules();
    const { ok, s: fs } = await import("@keel/schema");
    const { contract } = await import("../src/contract/contract.ts");
    const { manifest } = await import("../src/manifest.ts");
    const { routesArtifact } = await import("../src/routesArtifact.ts");
    const { action } = await import("../src/action.ts");
    const { loader } = await import("../src/loader.ts");
    const Out = fs.object({});
    const In = fs.object({});
    const Query = fs.object({ q: fs.string().optional() });
    const c = contract("v", {
      "v.page": { path: "/v", search: Query },
      "v.read": { method: "GET", path: "/api/v", query: Query, output: Out },
      "v.write": { method: "PATCH", path: "/api/v", output: Out },
    });
    const save = action(c, "v.page", { input: In }, async () => ok(null));
    const art = routesArtifact(
      manifest(c, {
        "v.page": { component: view, PUT: save, POST: save, PATCH: save, DELETE: save },
        "v.read": { loader: loader(c, "v.read", {}, async () => ok({})) },
        "v.write": { action: action(c, "v.write", {}, async () => ok({})) },
      }),
    );
    const query = { properties: { q: { minLength: 0, type: "string" } }, required: [], type: "object" };
    expect(art).toEqual({
      "v.page": {
        actions: ["DELETE", "PATCH", "POST", "PUT"],
        guard: null,
        layout: null,
        module: "v",
        params: null,
        path: "/v",
        search: query,
      },
      "v.read": {
        actions: [],
        api: true,
        guard: null,
        layout: null,
        method: "GET",
        module: "v",
        params: null,
        path: "/api/v",
        search: query,
      },
      "v.write": {
        actions: ["PATCH"],
        api: true,
        guard: null,
        layout: null,
        method: "PATCH",
        module: "v",
        params: null,
        path: "/api/v",
        search: null,
      },
    });
    expect(Object.keys(Object(art["v.page"]))).not.toContain("api");
    expect(Object.keys(Object(art["v.page"]))).not.toContain("method");
    expect(Object.keys(Object(art["v.read"]))).toEqual([
      "actions",
      "api",
      "guard",
      "layout",
      "method",
      "module",
      "params",
      "path",
      "search",
    ]);
  });
});
