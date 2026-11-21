// Spec: k.compiler, clause "An id, `path`, `layout`, `actions` or guard `redirect` unlike its contract or `routes.ts` literal (a placed stdlib module's: its package's `./contract` and `./routes`) is E1005."
// This file covers the reader half of the clause: `routeLiterals` reads a placed stdlib module's `./contract` and `./routes` files, never an app file's spread.
// Examples only: the inputs are fixed projects built in a temp dir. No random inputs (a fast-check seed would be 1337).
// A stdlib module is placed by its manifest id (`frag`) in a deployable's `modules` list of the `topology` option; its package's `module.ts` holds the manifest and the app module's `deps` name the package (k.module).
import fs from "node:fs";
import path from "node:path";
import { routeLiterals } from "@keel/compiler";
import { afterEach, beforeEach, expect, test } from "vitest";

let tmp = "";

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-frag-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, content: string): void {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function buildPackage(): void {
  write(
    "node_modules/@keel/std-frag/package.json",
    JSON.stringify({
      name: "@keel/std-frag",
      version: "0.0.0",
      exports: {
        "./contract": { node: "./src/contract.ts", import: "./src/contract.ts", default: "./src/contract.ts" },
        "./routes": { node: "./src/routes.ts", import: "./src/routes.ts", default: "./src/routes.ts" },
      },
    }),
  );
  write(
    "node_modules/@keel/std-frag/module.ts",
    "import { module } from '@keel/compiler'\nexport default module({ id: 'frag', deps: [], capabilities: [], public: { exports: [] } })\n",
  );
  write(
    "node_modules/@keel/std-frag/src/contract.ts",
    [
      'import { contract } from "@keel/router/contract";',
      'import { s } from "@keel/schema";',
      "export const frag = contract('frag', {",
      '  "frag.shell": { layout: true },',
      '  "frag.index": { path: "/frag" },',
      '  "frag.item": { path: "/frag/:id", params: s.object({ id: s.string() }), search: s.object({ q: s.string().optional() }) },',
      '  "frag.submit": { path: "/frag/submit" },',
      "});",
      "",
    ].join("\n"),
  );
  write(
    "node_modules/@keel/std-frag/src/routes.ts",
    [
      'import { action, guard, manifest } from "@keel/router";',
      'import { ok } from "@keel/schema";',
      'import { frag } from "./contract.ts";',
      "declare const View: () => Node;",
      "export const routes = manifest(frag, {",
      '  "frag.shell": { component: View },',
      '  "frag.index": { component: View, layout: "frag.shell" },',
      '  "frag.item": { component: View, guard: guard({ redirect: "frag.index" }, async () => ok(null)) },',
      '  "frag.submit": { component: View, POST: action(frag, "frag.submit", {}, async () => ok(null)) },',
      "});",
      "",
    ].join("\n"),
  );
}

function buildApp(spread: boolean): { path: string; source: string }[] {
  const contractTs = [
    'import { contract } from "@keel/router/contract";',
    'export const m = contract("m", { "m.home": { path: "/" } });',
    "",
  ].join("\n");
  const routesTs = [
    'import { manifest } from "@keel/router";',
    'import { routes as x } from "@keel/std-frag/routes";',
    'import { m } from "./m.contract.ts";',
    "declare const Home: () => Node;",
    `export const routes = manifest(m, { "m.home": { component: Home }${spread ? ", ...x.routes" : ""} });`,
    "",
  ].join("\n");
  const moduleTs =
    "import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: ['@keel/std-frag'], capabilities: [], public: { exports: [] } })\n";
  write("modules/m/module.ts", moduleTs);
  write("modules/m/m.contract.ts", contractTs);
  write("modules/m/routes.ts", routesTs);
  return [
    { path: "modules/m/module.ts", source: moduleTs },
    { path: "modules/m/m.contract.ts", source: contractTs },
    { path: "modules/m/routes.ts", source: routesTs },
  ];
}

const PLACED = { web: { modules: ["m", "frag"], adapter: "node" } } as const;
const APP_ONLY = { web: { modules: ["m"], adapter: "node" } } as const;

test("a placed stdlib module's `path`, `layout`, `actions` and guard `redirect` are read from its package's `./contract` and `./routes`", () => {
  buildPackage();
  const result = routeLiterals(buildApp(false), { root: tmp, topology: PLACED });
  expect(result).toBeDefined();
  expect(result?.closed).toBe(true);
  expect(result?.unread).toEqual([]);
  expect(result?.routes["m.home"]).toMatchObject({ path: "/", layout: null, guard: null, actions: [] });
  expect(result?.routes["frag.index"]).toMatchObject({ path: "/frag", layout: "frag.shell", guard: null, actions: [] });
  expect(result?.routes["frag.item"]).toMatchObject({
    path: "/frag/:id",
    layout: null,
    guard: "frag.index",
    actions: [],
    params: true,
    search: true,
  });
  expect(result?.routes["frag.submit"]).toMatchObject({ path: "/frag/submit", actions: ["POST"] });
});

test("a stdlib module no deployable places is not read", () => {
  buildPackage();
  const result = routeLiterals(buildApp(false), { root: tmp, topology: APP_ONLY });
  expect(result?.routes["m.home"]).toMatchObject({ path: "/" });
  expect(Object.keys(result?.routes ?? {}).filter((id) => id.startsWith("frag."))).toEqual([]);
});

test("`...x.routes` in an app binding reads nothing from the package and opens the id set (W1005 names the spread)", () => {
  buildPackage();
  const result = routeLiterals(buildApp(true), { root: tmp, topology: PLACED });
  expect(result).toBeDefined();
  expect(result?.closed).toBe(false);
  expect(result?.unread.some((u) => u.includes("...x.routes"))).toBe(true);
});
