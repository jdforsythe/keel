// A nested project's route manifest spreads a `deps` package's `routes` export; check() resolves it from the project.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { SourceFile } from "../src/index.ts";
import { canonicalJson } from "../src/internal/canonicalJson.ts";
import { hashOf } from "../src/internal/hashOf.ts";

const PKG = "@keel/std-frag";
let root = "";
let elsewhere = "";

const put = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "keel-frag-root-"));
  elsewhere = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "keel-frag-else-"));
  put(`apps/a/node_modules/${PKG}/package.json`, JSON.stringify({ exports: { "./routes": "./src/routes.ts" } }));
  put(
    `apps/a/node_modules/${PKG}/src/routes.ts`,
    `import { manifest } from "@keel/router";\nexport const routes = manifest({ "frag.a": { path: "/frag" } });\n`,
  );
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(elsewhere, { recursive: true, force: true });
});

const entry = (p: string, module: string) => ({
  actions: [],
  guard: null,
  layout: null,
  module,
  params: null,
  path: p,
  search: null,
});
const data = { "frag.a": entry("/frag", "frag"), "m.home": entry("/", "m") };
const files: SourceFile[] = [
  {
    path: "apps/a/modules/m/module.ts",
    source: `export default module({ id: "m", deps: ["${PKG}"], capabilities: [], public: { exports: [], routes: [] } });\n`,
  },
  {
    path: "apps/a/modules/m/routes.ts",
    source: `import { manifest } from "@keel/router";\nimport { routes as x } from "${PKG}/routes";\nexport const routes = manifest({ "m.home": { path: "/" }, ...x.routes });\n`,
  },
  { path: "apps/a/.keel/routes.json", source: `${canonicalJson({ data, hash: hashOf(data) })}\n` },
];
const routesDiags = (r: string) =>
  check(files, { root: r, types: false }).diagnostics.filter(
    (d) => d.path === "apps/a/.keel/routes.json" && (d.code === "W1005" || d.code === "E1005"),
  );

it("reads the fragment from the nested project's node_modules under the workspace root", () => {
  expect(process.cwd()).not.toBe(root);
  expect(routesDiags(root)).toEqual([]);
});

it("keeps W1005 for the spread when the root holds no such project", () => {
  expect(routesDiags(elsewhere).map((d) => d.code)).toEqual(["W1005"]);
});
