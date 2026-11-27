// routes.json compared with the caller's derivation; one compile per project.
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
])("routes.json against the caller's derivation (%s project)", (_name, prefix) => {
  const json = `${prefix}.keel/routes.json`;
  const home = { "m.home": entry() };
  const withDerived = (files: SourceFile[], text: string): readonly Diagnostic[] =>
    check(files, { types: false, derived: { [prefix]: { "routes.json": text } } }).diagnostics;

  it("without derived, an evaluated routes.json is not judged: no E1005, no W1005", () => {
    const variants: Record<string, Entry>[] = [
      home,
      { ...home, "m.admin": entry({ path: "/admin" }) },
      { "m.home": entry({ path: "/elsewhere" }) },
      {},
    ];
    for (const data of variants) {
      const ds = run(project(prefix, data));
      expect(at(ds, "E1005", json)).toEqual([]);
      expect(at(ds, "W1005", json)).toEqual([]);
    }
    const handEdit = `${canonicalJson({ data: home, hash: "fnv1a:00000000" })}\n`;
    const pretty = `${JSON.stringify(JSON.parse(routesJson(home)), null, 2)}\n`;
    for (const text of [handEdit, pretty]) {
      const files = [
        f(`${prefix}modules/m/m.contract.ts`, CONTRACT),
        f(`${prefix}modules/m/routes.ts`, BINDING),
        f(json, text),
      ];
      expect(at(run(files), "E1005", json)).toEqual([]);
    }
  });

  it("with derived equal to the file, there is no E1005 and no W1005", () => {
    const ds = withDerived(project(prefix, home), routesJson(home));
    expect(at(ds, "E1005", json)).toEqual([]);
    expect(at(ds, "W1005", json)).toEqual([]);
  });

  it.each([
    ["an added route", { ...home, "m.admin": entry({ path: "/admin" }) }],
    ["a changed path", { "m.home": entry({ path: "/elsewhere" }) }],
    ["a changed module", { "m.home": entry({ module: "x" }) }],
    ["a missing route", {}],
    ["wrong actions", { "m.home": entry({ actions: ["POST"] }) }],
  ])("with derived, %s in the file is one E1005 and no W1005", (_n, data) => {
    const ds = withDerived(project(prefix, data), routesJson(home));
    expect(at(ds, "E1005", json)).toHaveLength(1);
    expect(at(ds, "W1005", json)).toEqual([]);
  });

  it("with derived, the same data in non-canonical bytes is one E1005", () => {
    const text = `${JSON.stringify(JSON.parse(routesJson(home)), null, 2)}\n`;
    const files = [
      f(`${prefix}modules/m/m.contract.ts`, CONTRACT),
      f(`${prefix}modules/m/routes.ts`, BINDING),
      f(json, text),
    ];
    expect(at(withDerived(files, routesJson(home)), "E1005", json)).toHaveLength(1);
  });

  it("the derived text, not the contracts and bindings, decides: a literal-matching file differing from derived is E1005", () => {
    const ds = withDerived(project(prefix, home), routesJson({ "m.home": entry({ path: "/other" }) }));
    expect(at(ds, "E1005", json)).toHaveLength(1);
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
