// Shared helpers for the k.origins cli conformance files (not a test file). The real `keel` binary over a temp project with `@keel/*`
// linked, as compat-support.ts does. Seed 1337 for every property.
// ASSUMPTION: `keel build` writes `dist/<name>/csp.txt` for a `client` deployable and, for one declaring `tauri`,
// `deploy/<name>/tauri/tauri.conf.json` (k.security, k.shell); both are read as text.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Tree, readText } from "./compat-support.ts";

export const SEED = 1337;
export const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const routesSrc = (id: string, path: string): string =>
  `import { manifest } from '@keel/router'\nimport { Text } from '@keel/ui'\nconst Page = () => Text({ id: '${id}.page.text', children: '${id}' })\nexport const routes = manifest({ '${id}.page': { path: '${path}', component: Page } })\n`;

/** A project whose `topology.ts` default-exports `topology(<topologyArg>)` over module `a` (route `/a`) and module `c` (route `/`). */
export function tree(topologyArg: string, deps: Record<string, string> = {}): Tree {
  return {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: deps })}\n`,
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
    "topology.ts": `import { topology } from '@keel/server'\nexport default topology(${topologyArg})\n`,
    "modules/a/module.ts": manifestSrc("a"),
    "modules/a/routes.ts": routesSrc("a", "/a"),
    "modules/c/module.ts": manifestSrc("c"),
    "modules/c/routes.ts": routesSrc("c", "/"),
  };
}

/** `keel build [args]` with `env` added and every `KEEL_` and vitest key of the parent removed. */
export function build(dir: string, env: Record<string, string> = {}, args: string[] = []): number | null {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k.startsWith("KEEL_"))
      continue;
    clean[k] = v;
  }
  return spawnSync(process.execPath, [BIN, "build", "--format=json", ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...clean, ...env },
  }).status;
}

export const directivesOf = (policy: string): string[] =>
  policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "");

export const cspTxt = (dir: string, name: string): string => readText(dir, `dist/${name}/csp.txt`);
export const tauriConf = (dir: string, name: string): string => readText(dir, `deploy/${name}/tauri/tauri.conf.json`);

export const tauriPolicy = (dir: string, name: string): string => {
  const conf: unknown = JSON.parse(tauriConf(dir, name));
  const app: unknown = typeof conf === "object" && conf !== null ? Reflect.get(conf, "app") : undefined;
  const sec: unknown = typeof app === "object" && app !== null ? Reflect.get(app, "security") : undefined;
  const csp: unknown = typeof sec === "object" && sec !== null ? Reflect.get(sec, "csp") : undefined;
  return typeof csp === "string" ? csp : "";
};
