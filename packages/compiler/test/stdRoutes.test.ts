// k.routes Union: a placed stdlib module's binding is its package's `./routes` export and its contract its `./contract`.
// One resolver (`stdRoutes`, `stdContract`) feeds the server entry, the dev entry, the evaluated `routes.json` and the
// static route read.
// Examples only: fixed projects in a temp dir. No random inputs (a fast-check seed would be 1337).
import fs from "node:fs";
import path from "node:path";
import { routeLiterals } from "@keel/compiler";
import { evaluateViews } from "@keel/compiler/routes";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { devEntryCode } from "../src/internal/devEntryCode.ts";
import { projectManifests } from "../src/internal/projectManifests.ts";
import { serverEntryCode } from "../src/internal/serverEntryCode.ts";
import { stdContract } from "../src/std/stdContract.ts";
import { stdRoutes } from "../src/std/stdRoutes.ts";
import type { Topology } from "../src/types/Topology.ts";

// Real packages dir via a workspace link, so this also holds in Stryker's sandbox copy (where ../.. is not packages/).
const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";

const write = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const topology: Topology = { api: { modules: ["app", "frag"], adapter: "node" } };
const routesFile = (): string => fs.realpathSync(path.join(root, "node_modules/@keel/std-frag/src/routes.ts"));

beforeEach(() => {
  root = fs.realpathSync(tempDir(".tmp-std-routes-", import.meta.dirname));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
  write(
    "node_modules/@keel/std-frag/package.json",
    JSON.stringify({
      name: "@keel/std-frag",
      type: "module",
      exports: {
        ".": "./src/index.ts",
        "./contract": { default: "./src/contract.ts" },
        "./routes": { default: "./src/routes.ts" },
      },
    }),
  );
  write("node_modules/@keel/std-frag/src/index.ts", "export const x = 1;\n");
  write(
    "node_modules/@keel/std-frag/module.ts",
    'export default { id: "frag", deps: [], capabilities: [], public: { exports: [] } };\n',
  );
  write(
    "node_modules/@keel/std-frag/src/contract.ts",
    'import { contract } from "@keel/router/contract";\nexport const frag = contract("frag", { "frag.list": { path: "/frag" } });\n',
  );
  write(
    "node_modules/@keel/std-frag/src/routes.ts",
    'import { manifest } from "@keel/router";\nimport { frag } from "./contract.ts";\nconst V = () => null;\nexport const routes = manifest(frag, { "frag.list": { component: V } });\n',
  );
  write(
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ api: { modules: ["app", "frag"], adapter: "node" } });\n',
  );
  write(
    "modules/app/module.ts",
    'export default { id: "app", deps: ["@keel/std-frag"], capabilities: [], public: { exports: [] } };\n',
  );
  write(
    "modules/app/app.contract.ts",
    'import { contract } from "@keel/router/contract";\nexport const app = contract("app", { "app.home": { path: "/" } });\n',
  );
  write(
    "modules/app/routes.ts",
    'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nconst V = () => null;\nexport const routes = manifest(app, { "app.home": { component: V } });\n',
  );
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("stdRoutes (k.topology Route table)", () => {
  it("resolves a placed stdlib id through an app manifest's deps to the package's ./routes", () => {
    expect(stdRoutes(root, "frag")).toEqual([
      routesFile(),
      fs.realpathSync(path.join(root, "node_modules/@keel/std-frag")),
      "@keel/std-frag/routes",
    ]);
  });

  it("resolves the package's ./contract the same way", () => {
    expect(stdContract(root, "frag")).toEqual([
      fs.realpathSync(path.join(root, "node_modules/@keel/std-frag/src/contract.ts")),
      fs.realpathSync(path.join(root, "node_modules/@keel/std-frag")),
      "@keel/std-frag/contract",
    ]);
    expect(stdContract(root, "app")).toBeUndefined();
  });

  it("gives nothing for an app module, an unknown id, a package not in deps, or one without ./routes", () => {
    expect(stdRoutes(root, "app")).toBeUndefined();
    expect(stdRoutes(root, "nope")).toBeUndefined();
    write(
      "modules/app/module.ts",
      'export default { id: "app", deps: [], capabilities: [], public: { exports: [] } };\n',
    );
    expect(stdRoutes(root, "frag")).toBeUndefined();
    write(
      "modules/app/module.ts",
      'export default { id: "app", deps: ["@keel/std-frag"], capabilities: [], public: { exports: [] } };\n',
    );
    write(
      "node_modules/@keel/std-frag/package.json",
      JSON.stringify({ name: "@keel/std-frag", type: "module", exports: { ".": "./src/index.ts" } }),
    );
    expect(stdRoutes(root, "frag")).toBeUndefined();
  });

  it("is what the server and dev entries import for the stdlib module", () => {
    const file = JSON.stringify(routesFile());
    expect(serverEntryCode(root, "api", ["app", "frag"])).toContain(
      `const { routes: routes1 } = await import(${file});`,
    );
    expect(serverEntryCode(root, "api", ["app", "frag"])).toContain("routes: routeTable(routes0, routes1)");
    expect(devEntryCode(root, topology)).toContain(`(await import(${file})).routes)`);
  });

  it("lists the stdlib file among the project's manifests in module id order", () => {
    expect(projectManifests(topology, ["modules/app/routes.ts"], root)).toEqual([
      "modules/app/routes.ts",
      routesFile(),
    ]);
    expect(projectManifests(topology, ["modules/app/routes.ts"])).toEqual(["modules/app/routes.ts"]);
  });

  it(
    "reads the stdlib routes statically and evaluates them into routes.json",
    { timeout: fixedTime(30000) },
    async () => {
      const files = [
        "modules/app/module.ts",
        "modules/app/app.contract.ts",
        "modules/app/routes.ts",
        "topology.ts",
      ].map((p) => ({
        path: p,
        source: fs.readFileSync(path.join(root, p), "utf8"),
      }));
      const literals = routeLiterals(files, { topology, root });
      expect(Object.keys(literals?.routes ?? {}).sort()).toEqual(["app.home", "frag.list"]);
      expect(literals?.closed).toBe(true);
      const { routes } = await evaluateViews(root);
      expect(Object.keys(routes).sort()).toEqual(["app.home", "frag.list"]);
    },
  );
});
