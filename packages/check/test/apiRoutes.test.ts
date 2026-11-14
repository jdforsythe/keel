// k.api in keel check: E1510 and E1508 mapped from the type error on a manifest entry, E1511 for an API route a
// `client` or `static` deployable serves.
import path from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { Diagnostic, SourceFile } from "../src/index.ts";
import { applyPatch } from "./support/applyPatch.ts";

/** A directory `@keel/router` resolves from, so the manifest's types are checked. */
const ROOT = path.join(repoRoot(import.meta.dirname), "packages", "ui");
const PATH = "modules/a/routes.ts";
const routes = (body: string): SourceFile => ({
  path: PATH,
  source: `import { manifest, guard } from '@keel/router'\nimport { ok } from '@keel/schema'\ndeclare const Page: () => Node\nconst g = guard({}, async () => ok(null))\nexport const routes = manifest({\n${body}\n})\n`,
});
const typed = (body: string): readonly Diagnostic[] => check([routes(body)], { root: ROOT }).diagnostics;
const brief = (ds: readonly Diagnostic[]): string[] => ds.map((d) => `${d.code} ${d.line}:${d.col} ${d.message}`);

describe("E1510 and E1508 from the type check of a manifest entry", () => {
  it("an API entry with component is E1510 with a fix that removes it", () => {
    const body = "  'a.list': { api: true, path: '/api/list', component: Page },";
    const [d, ...rest] = typed(body);
    expect(rest).toEqual([]);
    expect([d?.code, d?.see, d?.line, d?.col, d?.message]).toEqual([
      "E1510",
      "k.api",
      6,
      3,
      "a.list: an API route has no component",
    ]);
    expect(applyPatch(PATH, routes(body).source, d?.fix ?? "")).toContain(
      "  'a.list': { api: true, path: '/api/list' },\n",
    );
  });

  it("removes every refused member, leading, inner and trailing, and the fixed source checks clean", () => {
    const body =
      "  'a.x': { component: Page, api: true, title: () => 'x', path: '/x', layout: 'a', errorElement: Page, },";
    const [d, ...rest] = typed(body);
    expect(rest).toEqual([]);
    expect(d?.message).toBe("a.x: an API route has no component, title, layout, errorElement");
    const before = routes(body).source;
    const after = applyPatch(PATH, before, d?.fix ?? "");
    expect(after).toBe(before.replace(body, "  'a.x': { api: true, path: '/x', },"));
    expect(check([{ path: PATH, source: after }], { root: ROOT }).diagnostics).toEqual([]);
  });

  it.each([
    [
      "an entry with neither component nor api",
      "  'a.x': { path: '/x' },",
      "a.x: an entry needs component, or api: true",
    ],
    ["an API entry without path", "  'a.x': { api: true },", "a.x: an API route needs a path"],
  ])("%s is E1510 with no fix", (_n, body, message) => {
    const ds = typed(body);
    expect(brief(ds)).toEqual([`E1510 6:3 ${message}`]);
    expect(ds[0]?.fix).toBeUndefined();
  });

  it.each([
    ["page", "  'a.x': { path: '/x', component: Page, guard: g },"],
    ["layout", "  'a.x': { component: Page, guard: g },"],
  ])("a guard without redirect on a %s is E1508 (k.guards)", (_n, body) => {
    const ds = typed(body);
    expect(brief(ds)).toEqual(["E1508 6:3 a.x: a guard without redirect guards API routes only"]);
    expect(ds[0]?.see).toBe("k.guards");
  });

  it("a guard without redirect on an API route, and a page, check clean", () => {
    expect(typed("  'a.x': { api: true, path: '/x', guard: g },\n  'a.p': { path: '/', component: Page },")).toEqual(
      [],
    );
  });

  it("another type error in an entry stays E1751", () => {
    expect(brief(typed("  'a.x': { path: 1, component: Page },")).map((s) => s.slice(0, 5))).toEqual(["E1751"]);
  });

  it("a manifest entry error with types off reports nothing", () => {
    expect(check([routes("  'a.x': { path: '/x' },")], { types: false }).diagnostics).toEqual([]);
  });

  it("names exactly the refused members of any API entry, in source order", () => {
    const refused = ["component", "errorElement", "title", "layout"] as const;
    const value = { component: "Page", errorElement: "Page", title: "() => 'x'", layout: "'a.l'" };
    fc.assert(
      fc.property(fc.shuffledSubarray([...refused], { minLength: 1 }), fc.boolean(), (members, first) => {
        const parts = members.map((m) => `${m}: ${value[m]}`);
        const kept = ["api: true", "path: '/x'"];
        const body = `  'a.x': { ${(first ? [...parts, ...kept] : [...kept, ...parts]).join(", ")} },`;
        const [d] = typed(body);
        expect(d?.message).toBe(`a.x: an API route has no ${members.join(", ")}`);
        expect(applyPatch(PATH, routes(body).source, d?.fix ?? "")).toContain("  'a.x': { api: true, path: '/x' },");
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});

describe("E1511 API route without a server", () => {
  const api: SourceFile = {
    path: PATH,
    source: "export const routes = manifest({ 'a.list': { api: true, path: '/api/list' } })\n",
  };
  const run = (adapter: "client" | "static" | "node", files: SourceFile[] = [api]) =>
    check(files, { types: false, topology: { web: { modules: ["a"], adapter } } }).diagnostics;

  it.each(["client", "static"] as const)("a %s deployable serving it is E1511 at topology.ts", (adapter) => {
    expect(run(adapter).map((d) => [d.code, d.path, d.see, d.message])).toEqual([
      ["E1511", "topology.ts", "k.api", `a.list: API route in ${adapter} deployable web, which has no server`],
    ]);
  });

  it("a node deployable serving it is clean", () => {
    expect(run("node")).toEqual([]);
  });

  it("a page in a client deployable is clean", () => {
    const page = { path: PATH, source: "export const routes = manifest({ 'a.home': { path: '/', component: P } })\n" };
    expect(run("client", [page])).toEqual([]);
  });

  it("an API entry read by following a constant, a spread or a literal computed key is E1511 from source alone", () => {
    const forms = [
      "export const routes = manifest({ 'a.list': { ['api']: true, path: '/api/list' } })\n",
      "const A = { api: true } as const\nexport const routes = manifest({ 'a.list': { ...A, path: '/api/list' } })\n",
      "const e = { api: true, path: '/api/list' } as const\nexport const routes = manifest({ 'a.list': e })\n",
      "const yes = true\nexport const routes = manifest({ ['a.list']: { api: yes, path: '/api/list' } })\n",
      "import { e } from './e'\nexport const routes = manifest({ 'a.list': { ...e, path: '/api/list' } })\n",
    ];
    const e = { path: "modules/a/e.ts", source: "export const e = { api: true } as const\n" };
    for (const source of forms) {
      const files = [{ path: PATH, source }, e];
      expect(run("client", files).map((d) => [d.code, d.message])).toEqual([
        ["E1511", "a.list: API route in client deployable web, which has no server"],
      ]);
      expect(run("node", files).filter((d) => d.code === "E1511")).toEqual([]);
    }
  });

  it("an API entry the source cannot read is E1511 from the evaluated routes.json, as createApp throws", () => {
    const json = (api: boolean): SourceFile => ({
      path: ".keel/routes.json",
      source: JSON.stringify({ "a.list": { ...(api && { api: true }), module: "a", path: "/api/list" } }),
    });
    const source = "export const routes = manifest({ 'a.list': { api: on(), path: '/api/list' } })\n";
    const files = [{ path: PATH, source }];
    expect(run("client", files).filter((d) => d.code === "E1511")).toEqual([]);
    expect(run("client", [...files, json(true)]).filter((d) => d.code === "E1511")).toHaveLength(1);
    expect(run("client", [...files, json(false)]).filter((d) => d.code === "E1511")).toEqual([]);
  });

  it("points at the module id in an app's topology.ts", () => {
    const top = {
      path: "apps/x/topology.ts",
      source: "export default topology({\n  web: { modules: ['a'], adapter: 'client' },\n})\n",
    };
    const ds = check([top, { ...api, path: `apps/x/${PATH}` }], { types: false }).diagnostics;
    expect(ds.map((d) => `${d.code} ${d.path}:${d.line}:${d.col}`)).toEqual(["E1511 apps/x/topology.ts:2:20"]);
  });
});
