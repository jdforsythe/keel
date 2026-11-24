// Spec: k.scaffold, Conformance "In the `node` project, `service { id: 'orders', name: 'gitHub', base: 'https://api.github.com' }` creates exactly `modules/orders/GitHubApi.schema.ts` (one export, `GitHubApi = endpoints({})`) and `modules/orders/api.server.ts` (one export, `api = service({ base: 'https://api.github.com', schema: GitHubApi })`), changes `package.json` alone, and leaves `keel check` and `keel test` clean; with `name: 'orders'` the edit set equals that of no `name`."
// Spec: k.scaffold, Conformance "In the `node` project, `service { id: 'orders', base: 'https://api.github.com', name }` with a `name` of `GitHub`, `git_hub`, `git-hub`, `1x` or `''` is E1352, nothing written. With `name: 'gitHub'` it is E1351 naming `modules/orders/api.server.ts` where that file exists, and E1351 naming `modules/orders/GitHubApi.schema.ts` where only that one does; nothing written."
// Spec: k.scaffold, Service "`<Name>` being `name` with its first letter upper-cased. It is lowerCamel, as a module id is (else E1352, nothing written, in either form); without it, `name` is the module id. The client is `api` in `api.server.ts` whatever the name, so a module holds one scaffolded service: a second is E1351."
// seed 1337 (properties over lowerCamel names and over strings outside the rule).
// Both forms over file maps: `{ id, name, base }` and `{ id, name, schema, service }`. The `--openapi` flag form runs in cli-service-flags.test.ts.
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { RUNS, SEED, apiName, apply, errText, read, scaffoldRaw, serviceInput, snap } from "./fixtures.ts";
import { cleanup, materialize } from "./keel-cli.ts";
import { dependencies, expectCheckAndTestClean, freshNode, testFileCount } from "./service-base-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const GITHUB = "https://api.github.com";
const RULE = /^[a-z][A-Za-z0-9]*$/;
const lowerCamel = fc.stringMatching(/^[a-z][A-Za-z0-9]{0,10}$/);
const outside = fc.oneof(
  fc.string({ maxLength: 12 }).filter((s) => !RULE.test(s)),
  lowerCamel.map((s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`),
  lowerCamel.map((s) => `${s}_x`),
  lowerCamel.map((s) => `${s}-x`),
  fc.stringMatching(/^[0-9][A-Za-z0-9]{0,6}$/),
  fc.constantFrom("GitHub", "git_hub", "git-hub", "1x", ""),
);
const exportsOf = (src: string): string[] =>
  [...src.matchAll(/^export\s+(?:const|function|class|let|var|default)\s+(\w+)/gm)].map((m) => m[1] ?? "");
const exportCount = (src: string): number => [...src.matchAll(/^export\b/gm)].length;
const upper = (n: string): string => `${n.charAt(0).toUpperCase()}${n.slice(1)}`;

describe("service name, base form", () => {
  it("service { id: 'orders', name: 'gitHub', base } creates exactly GitHubApi.schema.ts (one export, GitHubApi = endpoints({})) and api.server.ts (one export, api = service({ base, schema: GitHubApi }))", () => {
    const out = apply("service", { id: "orders", name: "gitHub", base: GITHUB }, freshNode());
    expect(out.created).toEqual(["modules/orders/GitHubApi.schema.ts", "modules/orders/api.server.ts"]);
    expect(out.removed).toEqual([]);
    const schema = read(out.files, "modules/orders/GitHubApi.schema.ts");
    const service = read(out.files, "modules/orders/api.server.ts");
    expect(exportsOf(schema)).toEqual(["GitHubApi"]);
    expect(exportCount(schema)).toBe(1);
    expect(schema).toMatch(/export const GitHubApi = endpoints\(\{\}\)/);
    expect(exportsOf(service)).toEqual(["api"]);
    expect(exportCount(service)).toBe(1);
    expect(service).toMatch(
      /export const api = service\(\{\s*base:\s*["']https:\/\/api\.github\.com["'],\s*schema:\s*GitHubApi\s*\}\)/,
    );
  });
  it("it changes package.json alone", () => {
    const before = freshNode();
    const out = apply("service", { id: "orders", name: "gitHub", base: GITHUB }, before);
    expect(out.changed).toEqual(["package.json"]);
    for (const [p, c] of before) if (p !== "package.json") expect(out.files.get(p), p).toBe(c);
    expect(dependencies(out.files)["@keel/services"]).toBe(dependencies(before)["@keel/server"]);
  });
  it("it leaves keel check and keel test clean", () => {
    const tree = apply("service", { id: "orders", name: "gitHub", base: GITHUB }, freshNode()).files;
    const dir = materialize(tree);
    dirs.push(dir);
    expectCheckAndTestClean(dir, testFileCount(tree));
  }, 120000);
  it("with name: 'orders' the edit set equals that of no name", () => {
    const a = apply("service", { id: "orders", base: GITHUB }, freshNode());
    const b = apply("service", { id: "orders", name: "orders", base: GITHUB }, freshNode());
    expect(b.created).toEqual(a.created);
    expect(b.changed).toEqual(a.changed);
    expect(b.removed).toEqual(a.removed);
    expect(snap(b.files)).toBe(snap(a.files));
    expect(b.created).toContain("modules/orders/OrdersApi.schema.ts");
  });
  it("for any lowerCamel name the declaration is <Name>Api in <Name>Api.schema.ts, <Name> being name with its first letter upper-cased, and the client is api in api.server.ts", () => {
    fc.assert(
      fc.property(lowerCamel, (name) => {
        const decl = `${upper(name)}Api`;
        expect(decl).toBe(apiName(name));
        const out = apply("service", { id: "orders", name, base: GITHUB }, freshNode());
        expect(out.created).toEqual([`modules/orders/${decl}.schema.ts`, "modules/orders/api.server.ts"].sort());
        const schema = read(out.files, `modules/orders/${decl}.schema.ts`);
        const service = read(out.files, "modules/orders/api.server.ts");
        expect(exportsOf(schema)).toEqual([decl]);
        expect(exportsOf(service)).toEqual(["api"]);
        expect(service).toMatch(new RegExp(`schema:\\s*${decl}\\s*\\}\\)`));
        expect(out.changed).toEqual(["package.json"]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("the default stays the module id: without name, the declaration is <Id>Api", () => {
    fc.assert(
      fc.property(lowerCamel, (id) => {
        const base = apply("module", { id }, freshNode()).files;
        const out = apply("service", { id, base: GITHUB }, base);
        expect(out.created).toContain(`modules/${id}/${apiName(id)}.schema.ts`);
        const named = apply("service", { id, name: id, base: GITHUB }, base);
        expect(snap(named.files)).toBe(snap(out.files));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("service name, schema and service form", () => {
  it("for any lowerCamel name, { id, name, schema, service } writes <Name>Api.schema.ts and api.server.ts", () => {
    fc.assert(
      fc.property(lowerCamel, (name) => {
        const decl = apiName(name);
        const out = apply("service", { ...serviceInput(name), id: "orders", name }, freshNode());
        expect(out.created).toEqual([`modules/orders/${decl}.schema.ts`, "modules/orders/api.server.ts"].sort());
        expect(exportsOf(read(out.files, "modules/orders/api.server.ts"))).toEqual(["api"]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("E1352, a service name that is not lowerCamel", () => {
  it("service { id: 'orders', base, name } with a name of GitHub, git_hub, git-hub, 1x or '' is E1352, nothing written", () => {
    for (const name of ["GitHub", "git_hub", "git-hub", "1x", ""]) {
      const files = freshNode();
      const before = snap(files);
      const r = scaffoldRaw("service", { id: "orders", base: GITHUB, name }, files);
      expect(r.ok, JSON.stringify(name)).toBe(false);
      expect(errText(r), JSON.stringify(name)).toContain("E1352");
      expect(snap(files)).toBe(before);
    }
  });
  it("for any string outside the rule both the base form and the schema-and-service form are E1352 and write nothing", () => {
    fc.assert(
      fc.property(outside, (name) => {
        expect(RULE.test(name)).toBe(false);
        for (const input of [
          { id: "orders", base: GITHUB, name },
          { id: "orders", name, schema: serviceInput("orders").schema, service: serviceInput("orders").service },
        ]) {
          const files = freshNode();
          const before = snap(files);
          const r = scaffoldRaw("service", input, files);
          expect(r.ok, JSON.stringify(name)).toBe(false);
          expect(errText(r), JSON.stringify(name)).toContain("E1352");
          expect(snap(files)).toBe(before);
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("E1351, one scaffolded service per module", () => {
  it("with name: 'gitHub' it is E1351 naming modules/orders/api.server.ts where that file exists, nothing written", () => {
    const files = apply("service", { id: "orders", name: "other", base: GITHUB }, freshNode()).files;
    const before = snap(files);
    const r = scaffoldRaw("service", { id: "orders", name: "gitHub", base: GITHUB }, files);
    expect(r.ok).toBe(false);
    expect(errText(r)).toContain("E1351");
    expect(errText(r)).toContain("modules/orders/api.server.ts");
    expect(snap(files)).toBe(before);
  });
  it("with name: 'gitHub' it is E1351 naming modules/orders/GitHubApi.schema.ts where only that one does, nothing written", () => {
    const files = freshNode();
    files.set("modules/orders/GitHubApi.schema.ts", "export const GitHubApi = {};\n");
    const before = snap(files);
    const r = scaffoldRaw("service", { id: "orders", name: "gitHub", base: GITHUB }, files);
    expect(r.ok).toBe(false);
    expect(errText(r)).toContain("E1351");
    expect(errText(r)).toContain("modules/orders/GitHubApi.schema.ts");
    expect(snap(files)).toBe(before);
  });
  it("a second scaffolded service in a module, under any name, is E1351 on api.server.ts", () => {
    fc.assert(
      fc.property(lowerCamel, lowerCamel, (first, second) => {
        const files = apply("service", { id: "orders", name: first, base: GITHUB }, freshNode()).files;
        const before = snap(files);
        const r = scaffoldRaw("service", { id: "orders", name: second, base: GITHUB }, files);
        expect(r.ok).toBe(false);
        expect(errText(r)).toContain("E1351");
        expect(errText(r)).toContain("modules/orders/api.server.ts");
        expect(snap(files)).toBe(before);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
