import { jsonText } from "../internal/jsonText.ts";
const KEEL = "^0.0.0";
const KERNEL = ["compiler", "ctx", "forms", "reactive", "router", "runtime-dom", "schema", "server", "store", "ui"];

/**
 * `package.json` of a new project. Standalone: scripts call `keel`, kernel packages as versioned dependencies,
 * `happy-dom` for the test environment `vite.config.ts` names.
 * `workspace`: an app inside the Keel monorepo; only `check`/`test`/`build` scripts, `workspace:*` dependencies.
 */
export function packageJson(name: string, workspace = false): string {
  const v = workspace ? "workspace:*" : KEEL;
  const scripts = workspace
    ? { build: "vite build", check: "tsc --noEmit && biome check modules test", test: "vitest run" }
    : { build: "keel build", check: "keel check", dev: "keel dev", test: "keel test" };
  const dev = workspace
    ? { "@keel/testing": v, "@keel/tooling": v, vite: "^8.3.6" }
    : { "@keel/cli": v, "@keel/testing": v, "happy-dom": "^21.0.4", typescript: "^5.6", vite: "^8.3.6", vitest: "^2" };
  const pkg = {
    name,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts,
    dependencies: Object.fromEntries(KERNEL.map((p) => [`@keel/${p}`, v])),
    devDependencies: dev,
  };
  return `${jsonText(pkg)}\n`;
}
