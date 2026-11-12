// Seed 1337. The k.compat pass (E1561, E1562) and `surface.json` freshness (E1005) over in-memory projects.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type SourceFile, check } from "../src/index.ts";
import { canonicalJson } from "../src/internal/canonicalJson.ts";
import { hashOf } from "../src/internal/hashOf.ts";
import { applyPatch } from "./support/applyPatch.ts";

const SEED = 1337;
const f = (path: string, source: string): SourceFile => ({ path, source });
const ANSWER = {
  type: "object",
  properties: { ok: { const: true }, value: { anyOf: [{ type: "string" }, { type: "null" }] } },
  required: ["ok", "value"],
  additionalProperties: false,
};
const str = { type: "string" };
const obj = (req: string[], opt: string[] = []) => ({
  type: "object",
  properties: Object.fromEntries([...req, ...opt].map((n) => [n, str])),
  required: req,
});
const getAnswer = (out: unknown) => ({
  type: "object",
  properties: {
    id: { const: "y.save" },
    results: {
      type: "object",
      properties: {
        "y.save": { type: "object", properties: { ok: { const: true }, value: out }, required: ["ok", "value"] },
      },
      required: ["y.save"],
    },
  },
  required: ["id", "results"],
});

const routesTs = (input: string, output = "s.object({ id: s.string() })") =>
  f(
    "modules/y/routes.ts",
    `import { action, loader, manifest } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nconst Page = () => null\nconst load = loader({ output: ${output} }, async () => ok({ id: 'i' }))\nconst save = action({\n  input: s.object({\n${input}\n  }),\n}, async () => ok(null))\nexport const routes = manifest({ 'y.save': { path: '/y/save', loader: load, component: Page } })\nroutes.actions({ 'y.save': { POST: save } })\n`,
  );
const apiTs = f(
  "modules/a/api.ts",
  "import { s } from '@keel/schema'\nimport { endpoints, service } from '@keel/services'\n" +
    "export const api = service({ module: 'y', schema: endpoints({\n" +
    "  list: { method: 'GET', path: '/y/save', output: s.json() },\n" +
    "  save: { method: 'POST', path: '/y/save', body: s.object({ name: s.string() }), output: s.json() },\n" +
    "}) })\n",
);

type Sv = { input: unknown; body: unknown; out?: unknown; endpointOut?: unknown; path?: string };
const data = (sv: Sv, sources: readonly SourceFile[]) => ({
  routes: {
    "y.save": {
      module: "y",
      path: "/y/save",
      file: "modules/y/routes.ts",
      params: null,
      search: null,
      get: getAnswer(sv.out ?? obj(["id"])),
      actions: { POST: { input: sv.input, answer: ANSWER } },
    },
  },
  services: [
    {
      file: "modules/a/api.ts",
      caller: "a",
      module: "y",
      endpoints: {
        list: {
          method: "GET",
          path: "/y/save",
          params: null,
          query: null,
          body: null,
          output: sv.endpointOut ?? {},
          errors: {},
        },
        save: {
          method: "POST",
          path: sv.path ?? "/y/save",
          params: null,
          query: null,
          body: sv.body,
          output: {},
          errors: {},
        },
      },
    },
  ],
  sources: Object.fromEntries(sources.map((s) => [s.path, hashOf(s.source)])),
});
const surface = (d: unknown) => f(".keel/surface.json", `${canonicalJson({ data: d, hash: hashOf(d) })}\n`);
const SPLIT = { x: { modules: ["a"], adapter: "node" }, y: { modules: ["y"], adapter: "node" } } as const;
const ONE = { x: { modules: ["a", "y"], adapter: "node" } } as const;
const run = (files: SourceFile[], opts: Parameters<typeof check>[1] = {}) =>
  check(files, { types: false, ...opts }).diagnostics.filter((d) => /^E(1561|1562|1005)$/.test(d.code));

describe("E1561", () => {
  it("is one diagnostic at the endpoint key naming the missing field, with no fix; none with the route's schema", () => {
    fc.assert(
      fc.property(fc.constantFrom("note", "qty", "label"), (field) => {
        const routes = routesTs(`    name: s.string(),\n    ${field}: s.string(),`);
        const sv = { input: obj(["name", field]), body: obj(["name"]) };
        const d = run([routes, apiTs, surface(data(sv, [routes, apiTs]))]);
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({ code: "E1561", path: "modules/a/api.ts", line: 5, col: 3 });
        expect(d[0]?.message).toContain(field);
        expect(d[0]?.fix).toBeUndefined();
        expect(run([routes, apiTs, surface(data({ ...sv, body: sv.input }, [routes, apiTs]))])).toEqual([]);
      }),
      { seed: SEED, numRuns: 3 },
    );
  });

  it("reports an endpoint no route serves, and a GET output that refuses the route's answer", () => {
    const routes = routesTs("    name: s.string(),");
    const sv = { input: obj(["name"]), body: obj(["name"]) };
    const missing = run([routes, apiTs, surface(data({ ...sv, path: "/y/gone" }, [routes, apiTs]))]);
    expect(missing.map((d) => d.message)).toEqual([expect.stringContaining("no route of y")]);
    const narrow = { type: "object", properties: { id: str }, required: ["id"], additionalProperties: false };
    const out = run([routes, apiTs, surface(data({ ...sv, endpointOut: narrow }, [routes, apiTs]))]);
    expect(out.map((d) => d.code)).toEqual(["E1561"]);
    expect(out[0]?.message).toContain("list output refuses y.save GET answer");
  });

  it("reads nothing from a stale or tampered surface: E1005 instead", () => {
    const routes = routesTs("    name: s.string(),\n    note: s.string(),");
    const sv = { input: obj(["name", "note"]), body: obj(["name"]) };
    const file = surface(data(sv, [routes, apiTs]));
    const edited = f(routes.path, `${routes.source}// edited\n`);
    expect(run([edited, apiTs, file]).map((d) => d.code)).toEqual(["E1005"]);
    expect(run([edited, apiTs, file])[0]?.message).toContain("does not match its sources");
    const tampered = f(file.path, file.source.replace('"name"', '"nome"'));
    expect(run([routes, apiTs, tampered]).map((d) => d.code)).toEqual(["E1005"]);
  });
});

describe("E1562", () => {
  const base = data({ input: obj(["name"]), body: obj(["name"]) }, []);

  it("an added required field is one E1562 at that field whose fix leaves none; none in one deployable", () => {
    const routes = routesTs("    name: s.string(),\n    note: s.string(),");
    const now = surface(data({ input: obj(["name", "note"]), body: obj(["name", "note"]) }, [routes, apiTs]));
    const d = run([routes, apiTs, now], { base, topology: SPLIT });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: "E1562", path: "modules/y/routes.ts", line: 8, col: 5 });
    expect(d[0]?.message).toBe("a.save (base) sends no note; y.save requires it");
    const fixed = applyPatch(routes.path, routes.source, d[0]?.fix ?? "");
    expect(fixed).toContain("note: s.string().optional(),");
    const after = f(routes.path, fixed);
    const loose = surface(data({ input: obj(["name"], ["note"]), body: obj(["name", "note"]) }, [after, apiTs]));
    expect(run([after, apiTs, loose], { base, topology: SPLIT })).toEqual([]);
    expect(run([routes, apiTs, now], { base, topology: ONE })).toEqual([]);
    expect(run([routes, apiTs, now], { topology: SPLIT })).toEqual([]);
  });

  it("a removed output field a base endpoint requires is one E1562 with no fix; an added field is none", () => {
    const routes = routesTs("    name: s.string(),");
    const withTitle = obj(["id", "title"]);
    const old = data({ input: obj(["name"]), body: obj(["name"]), endpointOut: getAnswer(withTitle) }, []);
    const now = surface(data({ input: obj(["name"]), body: obj(["name"]) }, [routes, apiTs]));
    const d = run([routes, apiTs, now], { base: old, topology: SPLIT });
    expect(d.map((x) => [x.code, x.message, x.fix])).toEqual([
      ["E1562", "a.list (base) needs title; y.save no longer answers it", undefined],
    ]);
    const more = surface(
      data({ input: obj(["name"]), body: obj(["name"]), out: obj(["id", "title", "more"]) }, [routes, apiTs]),
    );
    expect(run([routes, apiTs, more], { base: old, topology: SPLIT })).toEqual([]);
  });
  it("an added required field the route source does not spell out is one E1562 with no fix", () => {
    const literal = routesTs("    name: s.string(),\n    note: s.string(),");
    const source = literal.source
      .replace("const save = action({\n  input: s.object({", "const make = () =>\n  s.object({")
      .replace("  }),\n}, async", "  })\nconst save = action({\n  input: make(),\n}, async");
    const routes = f(literal.path, source);
    const now = surface(data({ input: obj(["name", "note"]), body: obj(["name", "note"]) }, [routes, apiTs]));
    const d = run([routes, apiTs, now], { base, topology: SPLIT });
    expect(d.map((x) => [x.code, x.message, x.fix])).toEqual([
      ["E1562", "a.save (base) sends no note; y.save requires it", undefined],
    ]);
  });
});
