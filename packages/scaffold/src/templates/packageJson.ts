import { jsonText } from "../internal/jsonText.ts";
const KERNEL = ["compiler", "ctx", "forms", "reactive", "router", "runtime-dom", "schema", "server", "store", "ui"];

/**
 * `package.json` of a new project. Standalone: scripts call `keel`, every `@keel/*` package at exactly `version` (the
 * creating tool's, k.create Versions), `engines.node` `>=22.15`, `packageManager` when given (k.create Package
 * manager), `happy-dom` for the test environment `vite.config.ts` names, `@types/node` for the type pass (k.check).
 * `workspace`: an app inside the Keel monorepo; the same `keel` scripts (`check` adds `tsc` and Biome over `modules`, which the repo's own
 * tooling runs), `workspace:*` dependencies, no versioned tool dependencies.
 */
export function packageJson(
  name: string,
  workspace = false,
  version = "0.0.0",
  packageManager: string | undefined = undefined,
): string {
  const v = workspace ? "workspace:*" : version;
  const scripts = {
    build: "keel build",
    check: workspace ? "tsc --noEmit && biome check modules && keel check" : "keel check",
    dev: "keel dev",
    test: "keel test",
  };
  const dev = workspace
    ? { "@keel/cli": v, "@keel/testing": v, "@keel/tooling": v, "@types/node": "^22", vite: "^8.3.6" }
    : {
        "@keel/cli": v,
        "@keel/testing": v,
        "@types/node": "^22",
        "happy-dom": "^21.0.4",
        typescript: "^5.6",
        vite: "^8.3.6",
        vitest: "^4.1.12",
      };
  const pkg = {
    name,
    version: "0.0.0",
    private: true,
    type: "module",
    ...(packageManager === undefined ? {} : { packageManager }),
    ...(workspace ? {} : { engines: { node: ">=22.15" } }),
    scripts,
    dependencies: Object.fromEntries(KERNEL.map((p) => [`@keel/${p}`, v])),
    devDependencies: dev,
  };
  return `${jsonText(pkg)}\n`;
}
