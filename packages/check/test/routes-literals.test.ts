// routes.json compared with the contract and binding literals; one compile per project.
import { parseTopology } from "@keel/compiler";
import { canonicalJson, hashOf } from "@keel/compiler/internal";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { Diagnostic, SourceFile } from "../src/index.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });

type Entry = {
  actions: string[];
  api?: true;
  method?: string;
  guard: string | null;
  layout: string | null;
  module: string;
  params: object | null;
  path: string;
  search: object | null;
};
const entry = (over: Partial<Entry> = {}): Entry => ({
  actions: [],
  guard: null,
  layout: null,
  module: "m",
  params: null,
  path: "/home",
  search: null,
  ...over,
});

/** A self-consistent canonical routes.json text for `data`. */
const routesJson = (data: Record<string, Entry>): string => `${canonicalJson({ data, hash: hashOf(data) })}\n`;

const CONTRACT = `import { contract } from "@keel/router/contract";
export const m = contract("m", { "m.home": { path: "/home" } });
`;
const BINDING = `import { manifest } from "@keel/router";
import { m } from "./m.contract.ts";
export const routes = manifest(m, { "m.home": { component: () => null } });
`;
const contractOf = (entries: string): string => `import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
export const m = contract("m", { ${entries} });
`;
const bindingOf = (entries: string): string => `import { manifest } from "@keel/router";
import { m } from "./m.contract.ts";
export const routes = manifest(m, { ${entries} });
`;
const GUARD_TS = `export const g = guard({ redirect: "m.home" }, async () => ok(null));\n`;

const run = (files: SourceFile[]): readonly Diagnostic[] => check(files, { types: false }).diagnostics;
const at = (ds: readonly Diagnostic[], code: string, path: string): readonly Diagnostic[] =>
  ds.filter((d) => d.code === code && d.path === path);

const project = (
  prefix: string,
  data: Record<string, Entry>,
  contractTs = CONTRACT,
  bindingTs = BINDING,
  extra: SourceFile[] = [],
) => [
  f(`${prefix}modules/m/m.contract.ts`, contractTs),
  f(`${prefix}modules/m/routes.ts`, bindingTs),
  ...extra,
  f(`${prefix}.keel/routes.json`, routesJson(data)),
];

describe.each([
  ["root", ""],
  ["nested", "apps/a/"],
])("routes.json vs contracts and bindings (%s project)", (_name, prefix) => {
  const json = `${prefix}.keel/routes.json`;
  const home = { "m.home": entry() };
  const apiContract = contractOf(
    `"m.home": { path: "/home" }, "m.api": { method: "GET", path: "/api", output: s.json() }`,
  );
  const apiBinding = bindingOf(`"m.home": { component: () => null }, "m.api": { loader: () => null }`);
  const apiData = (over: Partial<Entry> = {}) => ({
    ...home,
    "m.api": entry({ api: true, method: "GET", path: "/api", ...over }),
  });

  it("a genuine literal file has no E1005 and no W1005", () => {
    const ds = run(project(prefix, home));
    expect(at(ds, "E1005", json)).toEqual([]);
    expect(at(ds, "W1005", json)).toEqual([]);
  });

  it("an added route is E1005 naming it, with no fix", () => {
    const ds = at(run(project(prefix, { ...home, "m.admin": entry({ path: "/admin" }) })), "E1005", json);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(
      '.keel/routes.json differs from the contracts and bindings at "m.admin"; run keel build',
    );
    expect(ds[0]?.fix).toBeUndefined();
  });

  it.each([
    ["changed path", { "m.home": entry({ path: "/elsewhere" }) }],
    ["changed module", { "m.home": entry({ module: "x" }) }],
    ["missing route", {}],
    ["wrong actions", { "m.home": entry({ actions: ["POST"] }) }],
  ])("%s is E1005 at m.home", (_n, data) => {
    const ds = at(run(project(prefix, data)), "E1005", json);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toContain('"m.home"');
  });

  it("a bound action verb is read from the binding", () => {
    const binding = bindingOf(`"m.home": { component: () => null, POST: () => null }`);
    expect(
      at(run(project(prefix, { "m.home": entry({ actions: ["POST"] }) }, CONTRACT, binding)), "E1005", json),
    ).toEqual([]);
    expect(at(run(project(prefix, home, CONTRACT, binding)), "E1005", json)[0]?.message).toContain('"m.home"');
  });

  it("params presence flipped is E1005", () => {
    const c = contractOf(`"m.home": { path: "/home", params: { id: s.string() } }`);
    expect(at(run(project(prefix, home, c)), "E1005", json)[0]?.message).toContain('"m.home"');
    expect(at(run(project(prefix, { "m.home": entry({ params: {} }) }, c)), "E1005", json)).toEqual([]);
  });

  it("a guard differing from the imported guard is E1005 naming that id", () => {
    const binding = `import { manifest } from "@keel/router";
import { m } from "./m.contract.ts";
import { g } from "./g.guard.ts";
export const routes = manifest(m, { "m.home": { guard: g, component: () => null } });
`;
    const guardFile = f(`${prefix}modules/m/g.guard.ts`, GUARD_TS);
    const ds = at(run(project(prefix, home, CONTRACT, binding, [guardFile])), "E1005", json);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toContain('"m.home"');
  });

  it("api and method in routes.json must match the contract entry's method", () => {
    const ok = run(project(prefix, apiData(), apiContract, apiBinding));
    expect(at(ok, "E1005", json)).toEqual([]);
    expect(at(ok, "W1005", json)).toEqual([]);
    const wrongMethod = apiData({ method: "DELETE" });
    expect(at(run(project(prefix, wrongMethod, apiContract, apiBinding)), "E1005", json)[0]?.message).toContain(
      '"m.api"',
    );
    const notApi = { ...home, "m.api": entry({ path: "/api" }) };
    expect(at(run(project(prefix, notApi, apiContract, apiBinding)), "E1005", json)[0]?.message).toContain('"m.api"');
  });

  it("an api method that is not a literal is not compared (W1005 names it)", () => {
    const c = contractOf(
      `"m.home": { path: "/home" }, "m.api": { method: "GE" + "T", path: "/api", output: s.json() }`,
    );
    const ds = run(project(prefix, apiData({ method: "POST" }), c, apiBinding));
    expect(at(ds, "E1005", json)).toEqual([]);
    expect(at(ds, "W1005", json)[0]?.message).toContain("m.api method");
    const whole = contractOf(`"m.home": makeRoute()`);
    expect(at(run(project(prefix, home, whole)), "E1005", json)).toEqual([]);
  });

  it("a computed path with a genuine file is W1005 naming the part", () => {
    const c = contractOf(`"m.home": { path: "/ho" + "me" }`);
    const ds = run(project(prefix, home, c));
    expect(at(ds, "E1005", json)).toEqual([]);
    expect(at(ds, "W1005", json).map((d) => d.message)).toEqual([
      ".keel/routes.json unverified, not literal: m.home path",
    ]);
  });

  it("two unread parts end (+1 more)", () => {
    const c = contractOf(`"m.home": { path: "/ho" + "me" }`);
    const binding = bindingOf(`"m.home": { layout: "a" + "b", component: () => null }`);
    const w = at(run(project(prefix, home, c, binding)), "W1005", json);
    expect(w).toHaveLength(1);
    expect(w[0]?.message.endsWith("(+1 more)")).toBe(true);
  });

  it("an extra id under a spread contract is W1005, not E1005 (open id set)", () => {
    const c = contractOf(`...more, "m.home": { path: "/home" }`);
    const ds = run(project(prefix, { ...home, "m.extra": entry({ path: "/extra" }) }, c));
    expect(at(ds, "E1005", json)).toEqual([]);
    expect(at(ds, "W1005", json)).toHaveLength(1);
  });

  it("an extra id under a spread binding is W1005, not E1005 (open id set)", () => {
    const binding = bindingOf(`...more, "m.home": { component: () => null }`);
    const ds = run(project(prefix, { ...home, "m.extra": entry({ path: "/extra" }) }, CONTRACT, binding));
    expect(at(ds, "E1005", json)).toEqual([]);
    expect(at(ds, "W1005", json)).toHaveLength(1);
  });

  it("non-canonical bytes of a matching file are E1005 with a fix", () => {
    const text = `${JSON.stringify(JSON.parse(routesJson(home)), null, 2)}\n`;
    const ds = at(
      run([f(`${prefix}modules/m/m.contract.ts`, CONTRACT), f(`${prefix}modules/m/routes.ts`, BINDING), f(json, text)]),
      "E1005",
      json,
    );
    expect(ds).toHaveLength(1);
    expect(ds[0]?.fix).toBeDefined();
  });

  it("a file that is not self-consistent is E1005 hand edit", () => {
    const text = `${canonicalJson({ data: home, hash: "fnv1a:00000000" })}\n`;
    const ds = at(
      run([f(`${prefix}modules/m/m.contract.ts`, CONTRACT), f(`${prefix}modules/m/routes.ts`, BINDING), f(json, text)]),
      "E1005",
      json,
    );
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toContain("hand edit");
  });
});

describe("one compile per project (backlog 0149)", () => {
  const ROOT_TOP = f("topology.ts", `export default { api: { modules: ["todos"], adapter: "node" } };`);
  const APP_TOP = f("apps/a/topology.ts", `export default { web: { modules: ["todos"], adapter: "client" } };`);
  const LOAD = (p: string) => f(`${p}modules/todos/load.server.ts`, "export const load = (): number => 1;\n");
  const VIEW = (p: string) =>
    f(
      `${p}modules/todos/view.ts`,
      `import { load } from "./load.server.ts";\nexport const view = (): number => load();\n`,
    );
  const topology = parseTopology(ROOT_TOP.source).topology;

  it("an app's own topology applies to its files; the root's does not", () => {
    const all = [ROOT_TOP, APP_TOP, LOAD("apps/a/"), VIEW("apps/a/")];
    const ds = check(all, { types: false, topology }).diagnostics;
    expect(ds.filter((d) => d.code === "E1004")).toEqual([]);

    const appTopology = parseTopology(APP_TOP.source).topology;
    const alone = check([LOAD(""), VIEW("")], { types: false, topology: appTopology }).diagnostics;
    const prefixed = alone.map((d) => ({ ...d, path: d.path === "" ? "" : `apps/a/${d.path}` }));
    const inApp = ds.filter((d) => d.path.startsWith("apps/a/"));
    expect(inApp).toEqual(prefixed);
  });

  it("control: without apps/a/topology.ts the root topology applies and E1004 is reported", () => {
    // Under the root, `apps/a/` is no module: `view.ts` is client code once a root route component reaches it.
    const page = f(
      "modules/todos/Page.ts",
      'import { view } from "../../apps/a/modules/todos/view.ts";\nexport default view;\n',
    );
    const routes = f(
      "modules/todos/routes.ts",
      'import { manifest } from "@keel/router";\nimport { todos } from "./todos.contract.ts";\nimport Page from "./Page.ts";\nexport const routes = manifest(todos, { "todos.p": { component: Page } });\n',
    );
    const contractFile = f(
      "modules/todos/todos.contract.ts",
      'import { contract } from "@keel/router/contract";\nexport const todos = contract("todos", { "todos.p": { path: "/" } });\n',
    );
    const all = [ROOT_TOP, LOAD("apps/a/"), VIEW("apps/a/"), page, contractFile, routes];
    const ds = check(all, { types: false, topology }).diagnostics;
    expect(at(ds, "E1004", "apps/a/modules/todos/view.ts").length).toBeGreaterThan(0);
  });

  it("a topology.ts that is not a topology does not make a project", () => {
    const notTop = f("packages/x/src/topology.ts", "export function topology() {}\n");
    const bad = f("packages/x/src/bad.ts", "import { x } from './nope.server.ts';\nexport const y = x;\n");
    const withIt = check([notTop, bad], { types: false }).diagnostics;
    const without = check([bad], { types: false }).diagnostics;
    expect(withIt).toEqual(without);
    for (const d of withIt) expect(d.path === "" || d.path.startsWith("packages/x/src/")).toBe(true);
  });
});
