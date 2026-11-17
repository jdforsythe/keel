// Seed 1337. `surfaceOf` (the `.keel/surface.json` data, k.compat Surface) and `--base` reading (`baseInput`).
import { action, loader, manifest } from "@keel/router";
import { routeActions } from "@keel/router/internal";
import { ok, s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { baseInput } from "../src/internal/baseInput.ts";
import { surfaceOf } from "../src/internal/surfaceOf.ts";

const SEED = 1337;
const Page = () => document.createElement("div");
const Item = s.object({ id: s.string(), title: s.string() });
const Note = s.object({ text: s.string({ max: 80 }) });

function evaluated() {
  const shell = loader({ output: s.object({ user: s.string() }) }, async () => ok({ user: "u" }));
  const show = loader({ output: Item }, async () => ok({ id: "i", title: "t" }));
  const routes = manifest({
    "y.shell": { component: Page, loader: shell },
    "y.item": {
      path: "/y/:id",
      params: s.object({ id: s.string() }),
      layout: "y.shell",
      loader: show,
      component: Page,
    },
  });
  routes.actions({ "y.item": { POST: action({ input: Note }, async () => ok(null)) } });
  const schema = endpoints({
    get: { method: "GET", path: "/y/:id", params: s.object({ id: s.string() }), output: s.json() },
    note: {
      method: "POST",
      path: "/y/:id",
      params: s.object({ id: s.string() }),
      body: Note,
      output: s.json(),
      errors: { 409: s.json() },
    },
  });
  const bound = new Map<object, unknown>(Object.values(routes.routes).map((d) => [d, routeActions.get(d)]));
  return {
    manifests: [{ file: "modules/y/routes.ts", routes }],
    actionsOf: (def: object) => bound.get(def),
    services: [
      { file: "modules/a/api.ts", opts: { module: "y", schema } },
      { file: "src/outside.ts", opts: { module: "y", schema } },
      { file: "modules/a/other.ts", opts: { base: "https://x.test", schema } },
    ],
    sources: { "modules/y/routes.ts": "fnv1a:00000000" },
  };
}

describe("surfaceOf", () => {
  it("records path routes with params, the loader's GET answer, action input and answer, and module services", () => {
    const d = surfaceOf(evaluated());
    expect(Object.keys(d.routes ?? {})).toEqual(["y.item"]);
    expect(d).toMatchObject({
      version: 1,
      routes: {
        "y.item": {
          module: "y",
          path: "/y/:id",
          file: "modules/y/routes.ts",
          params: { type: "object", required: ["id"] },
          search: null,
          actions: {
            POST: {
              input: { type: "object", required: ["text"] },
              answer: { anyOf: [{ type: "string" }, { type: "null" }] },
            },
          },
          get: { type: "object", required: ["id", "title"] },
        },
      },
      services: [
        {
          file: "modules/a/api.ts",
          caller: "a",
          module: "y",
          endpoints: {
            get: { method: "GET", body: null, query: null, output: {}, errors: {} },
            note: { method: "POST", body: { properties: { text: { maxLength: 80 } } }, errors: { "409": {} } },
          },
        },
      ],
      sources: { "modules/y/routes.ts": "fnv1a:00000000" },
    });
    expect(d.services).toHaveLength(1);
  });

  it("records an API route (no component, no layout) with its GET answer and an action's output as its answer", () => {
    const routes = manifest({
      "y.feed": {
        api: true,
        path: "/y/feed",
        loader: loader({ output: Item }, async () => ok({ id: "i", title: "t" })),
      },
    });
    routes.actions({
      "y.feed": { POST: action({ input: Note, output: Item }, async () => ok({ id: "i", title: "t" })) },
    });
    const bound = new Map<object, unknown>(Object.values(routes.routes).map((d) => [d, routeActions.get(d)]));
    const d = surfaceOf({
      manifests: [{ file: "modules/y/routes.ts", routes }],
      actionsOf: (def: object) => bound.get(def),
      services: [],
      sources: {},
    });
    expect(d.version).toBe(1);
    expect(d.routes).toMatchObject({
      "y.feed": {
        module: "y",
        path: "/y/feed",
        actions: { POST: { input: { required: ["text"] }, answer: { type: "object", required: ["id", "title"] } } },
        get: { type: "object", required: ["id", "title"] },
      },
    });
  });

  it("is deterministic: the same evaluation gives the same JSON", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(JSON.stringify(surfaceOf(evaluated()))).toBe(JSON.stringify(surfaceOf(evaluated())));
      }),
      { seed: SEED, numRuns: 3 },
    );
  });
});

describe("baseInput", () => {
  const surface = JSON.stringify({ data: { version: 1, routes: {}, services: [], sources: {} }, hash: "fnv1a:0" });
  const io = (files: Record<string, string>, outside: Record<string, string> = {}) => ({
    cwd: "/w",
    files: Object.entries(files).map(([path, source]) => ({ path: `/w/${path}`, source })),
    read: (p: string) => outside[p],
  });

  it("is undefined without --base, the parsed file from the project or outside it, else one W1568 at the file", () => {
    expect(baseInput({}, io({}))).toEqual({ value: undefined });
    expect(baseInput({ base: "base.json" }, io({ "base.json": surface }))).toEqual({ value: JSON.parse(surface) });
    expect(baseInput({ base: "../b.json" }, io({}, { "../b.json": surface })).warn).toBeUndefined();
    const older = surface.replace('"version":1', '"version":0');
    for (const files of [{}, { "base.json": "{" }, { "base.json": "{}" }, { "base.json": older }]) {
      const r = baseInput({ base: "base.json" }, io(files));
      expect(r.value).toBeUndefined();
      expect([r.warn?.code, r.warn?.path, r.warn?.message]).toEqual([
        "W1568",
        "base.json",
        "no base surface of version 1; E1562 not checked",
      ]);
    }
  });
});
