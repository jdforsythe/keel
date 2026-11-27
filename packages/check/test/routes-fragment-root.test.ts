// A nested project places a stdlib module; check() reads its package's `./contract` and `./routes` from the project's node_modules.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { canonicalJson, hashOf } from "@keel/compiler/internal";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { SourceFile } from "../src/index.ts";

const PKG = "@keel/std-frag";
let root = "";
let elsewhere = "";

const put = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

beforeEach(() => {
  root = tempDir("keel-frag-root-", fs.realpathSync(os.tmpdir()));
  put(
    "apps/a/modules/m/module.ts",
    `export default module({ id: "m", deps: ["${PKG}"], capabilities: [], public: { exports: [], routes: [] } });\n`,
  );
  elsewhere = tempDir("keel-frag-else-", fs.realpathSync(os.tmpdir()));
  put(
    `apps/a/node_modules/${PKG}/package.json`,
    JSON.stringify({ exports: { "./contract": "./src/contract.ts", "./routes": "./src/routes.ts" } }),
  );
  put(
    `apps/a/node_modules/${PKG}/module.ts`,
    `export default module({ id: "frag", capabilities: [], public: { exports: [], routes: [] } });\n`,
  );
  put(
    `apps/a/node_modules/${PKG}/src/contract.ts`,
    `import { contract } from "@keel/router/contract";\nexport const frag = contract("frag", { "frag.a": { path: "/frag" } });\n`,
  );
  put(
    `apps/a/node_modules/${PKG}/src/routes.ts`,
    `import { manifest } from "@keel/router";\nimport { frag } from "./contract.ts";\nexport const routes = manifest(frag, { "frag.a": { component: () => null } });\n`,
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
    path: "apps/a/topology.ts",
    source: `export default { web: { modules: ["m", "frag"], adapter: "client" } };\n`,
  },
  {
    path: "apps/a/modules/m/module.ts",
    source: `export default module({ id: "m", deps: ["${PKG}"], capabilities: [], public: { exports: [], routes: [] } });\n`,
  },
  {
    path: "apps/a/modules/m/m.contract.ts",
    source: `import { contract } from "@keel/router/contract";\nexport const m = contract("m", { "m.home": { path: "/" } });\n`,
  },
  {
    path: "apps/a/modules/m/routes.ts",
    source: `import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\nexport const routes = manifest(m, { "m.home": { component: () => null } });\n`,
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

it("reports nothing on routes.json when the root holds no such project: W1005 is never reported", () => {
  expect(routesDiags(elsewhere)).toEqual([]);
});
