// Spec: k.deploy Conformance 11, "`keel build` under `NODE_ENV=staging`, or with `NODE_ENV=development` in `.env`, builds an entry with `mode` `'production'` and no inspect reporter."
// Spec: k.deploy Build, "`keel build` runs Vite with `NODE_ENV=production`, whatever the shell or `.env` sets: the entries' `mode` is `'production'` and `import.meta.env.DEV` is `false`."
// Seed: 1337 (no random input: the environments are enumerated).
// The real binary over one temp `client` project with `@keel/*` and `vite` linked, built once per environment into `dist/<name>/assets/*.js`.
// The route component holds one string outside any condition and one only inside `if (import.meta.env.DEV)`: a production bundle holds the first, never the second, and never the inspect reporter's endpoint (a dev build holds both).
// A successful build prints only the `ok` trailer.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const files = (): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['c'], adapter: 'client' } })\n",
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/Page.tsx":
    "/// <reference types=\"vite/client\" />\nimport { Box, Text } from '@keel/ui'\nexport default function Page() {\n  console.log('keel-always-marker-41c9')\n  if (import.meta.env.DEV) console.log('keel-dev-only-marker-7f3a')\n  return (\n    <Box as=\"main\">\n      <Text>home</Text>\n    </Box>\n  )\n}\n",
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nexport const routes = manifest({ 'c.page': { path: '/', component: Page } })\n",
});

let dir = "";
beforeAll(() => {
  dir = materialize(files());
}, SLOW);
afterAll(() => cleanup(dir));

/** `keel build` in the fixture with `NODE_ENV` set to `nodeEnv` (unset when undefined); returns the run and the bundle text. */
function build(nodeEnv: string | undefined): { status: number | null; stdout: string; bundle: string } {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    env[k] = v;
  }
  if (nodeEnv !== undefined) env.NODE_ENV = nodeEnv;
  rmSync(join(dir, "dist"), { recursive: true, force: true });
  const r = spawnSync(process.execPath, [BIN, "build"], { cwd: dir, encoding: "utf8", env });
  const assets = join(dir, "dist", "web", "assets");
  let bundle = "";
  try {
    for (const f of readdirSync(assets)) if (f.endsWith(".js")) bundle += readFileSync(join(assets, f), "utf8");
  } catch {
    // no assets: the assertions on `bundle` fail
  }
  return { status: r.status, stdout: r.stdout, bundle };
}

const ALWAYS = "keel-always-marker-41c9";
const DEV_ONLY = "keel-dev-only-marker-7f3a";

/** The bundle is a production bundle: the app code is in it, the dev-only string and the inspect reporter are not. */
function expectProduction(bundle: string): void {
  expect(bundle).toContain(ALWAYS);
  expect(bundle).not.toContain(DEV_ONLY);
  expect(bundle).not.toContain("/__keel/inspect");
}

const okOnly = (stdout: string): boolean => {
  const lines = stdout.split("\n").filter((l) => l.length > 0);
  return lines.length === 1 && /^ok\b/.test(lines[0] ?? "");
};

describe("k.deploy Conformance 11: keel build writes the production client", () => {
  test(
    "`keel build` under `NODE_ENV=staging` builds an entry with `mode` 'production' and no inspect reporter",
    () => {
      const r = build("staging");
      expect(r.status).toBe(0);
      expectProduction(r.bundle);
    },
    SLOW,
  );

  test(
    "`keel build` under `NODE_ENV=test` builds an entry with `mode` 'production' and no inspect reporter",
    () => {
      const r = build("test");
      expect(r.status).toBe(0);
      expectProduction(r.bundle);
    },
    SLOW,
  );

  test(
    "`keel build` with `NODE_ENV=development` in `.env` and none in the environment builds an entry with `mode` 'production' and no inspect reporter",
    () => {
      writeFileSync(join(dir, ".env"), "NODE_ENV=development\n");
      try {
        const r = build(undefined);
        expect(r.status).toBe(0);
        expectProduction(r.bundle);
      } finally {
        rmSync(join(dir, ".env"), { force: true });
      }
    },
    SLOW,
  );

  test(
    "a build that overrides `NODE_ENV` prints only the `ok` trailer",
    () => {
      const r = build("staging");
      expect(r.status).toBe(0);
      expect(okOnly(r.stdout), r.stdout).toBe(true);
    },
    SLOW,
  );
});
