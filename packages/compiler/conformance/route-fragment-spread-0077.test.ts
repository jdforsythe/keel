// Spec: k.compiler, clause "`...x.routes` of a `deps` package reads its literal routes; of another package it is W1005." (rfc:0077)
// Examples only: the inputs are two fixed projects built in a temp dir. No random inputs (a fast-check seed would be 1337).
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
      exports: { "./routes": { node: "./src/routes.ts", import: "./src/routes.ts", default: "./src/routes.ts" } },
    }),
  );
  write(
    "node_modules/@keel/std-frag/src/routes.ts",
    [
      'import { manifest } from "@keel/kernel";',
      "export const routes = manifest({",
      '  "frag.index": { path: "/frag" },',
      '  "frag.item": { path: "/frag/:id", params: { id: "string" }, search: { q: "string" } },',
      '  "frag.submit": { path: "/frag/submit" },',
      "});",
      'routes.actions({ "frag.submit": { POST: async () => {} } });',
      "",
    ].join("\n"),
  );
}

function buildApp(deps: string): { path: string; source: string }[] {
  const moduleTs = `import { module } from "@keel/kernel";\nexport default module({ id: "m", deps: ${deps}, capabilities: [], public: { exports: [], routes: [] } });\n`;
  const routesTs = [
    'import { manifest } from "@keel/kernel";',
    'import { routes as x } from "@keel/std-frag/routes";',
    'export const routes = manifest({ "m.home": { path: "/" }, ...x.routes });',
    "",
  ].join("\n");
  write("modules/m/module.ts", moduleTs);
  write("modules/m/routes.ts", routesTs);
  return [
    { path: "modules/m/module.ts", source: moduleTs },
    { path: "modules/m/routes.ts", source: routesTs },
  ];
}

test("`...x.routes` of a `deps` package reads its literal routes", () => {
  buildPackage();
  const files = buildApp('["@keel/std-frag"]');
  const result = routeLiterals(files, { root: tmp });
  expect(result).toBeDefined();
  expect(result?.closed).toBe(true);
  expect(result?.unread).toEqual([]);
  expect(result?.routes["m.home"]).toEqual({
    path: "/",
    layout: null,
    guard: null,
    actions: [],
    params: false,
    search: false,
  });
  expect(result?.routes["frag.index"]).toEqual({
    path: "/frag",
    layout: null,
    guard: null,
    actions: [],
    params: false,
    search: false,
  });
  expect(result?.routes["frag.item"]).toEqual({
    path: "/frag/:id",
    layout: null,
    guard: null,
    actions: [],
    params: true,
    search: true,
  });
  expect(result?.routes["frag.submit"]).toEqual({
    path: "/frag/submit",
    layout: null,
    guard: null,
    actions: ["POST"],
    params: false,
    search: false,
  });
});

test("`...x.routes` of a package not in `deps` is W1005: the id set is open and the spread is named by its source text", () => {
  buildPackage();
  const files = buildApp("[]");
  const result = routeLiterals(files, { root: tmp });
  expect(result).toBeDefined();
  expect(result?.closed).toBe(false);
  expect(result?.routes["m.home"]).toEqual({});
  expect(result?.unread).toEqual(["m.home", "modules/m/routes.ts ...x.routes"]);
});
