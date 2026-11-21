// Spec: k.security, Conformance "`keel build` of a fixture with a `client` deployable writes its `csp.txt` with `script-src 'self'`."
// Seed: 1337 (no generated input: one fixture, spawned builds). The real binary over a temp project with `@keel/*` linked, as compat-support.ts does.
// ASSUMPTION: the `client` deployable `w` writes `dist/w/csp.txt`; the peer origin comes from `KEEL_PEER_<NAME>` at build (k.hosting).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const routesSrc = (id: string, path: string): string =>
  `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(${id}, { '${id}.page': { component: Page } })\n`;
const contractSrc = (id: string, path: string): string =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '${path}' } })\n`;

const pageSrc =
  "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>page</Text>\n    </Box>\n  )\n}\n";

const files = (): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "index.html":
    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>fx</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/@keel/entry.ts"></script>\n  </body>\n</html>\n',
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  api: { modules: ['a'], adapter: 'node' },\n  w: { modules: ['c'], adapter: 'client' },\n})\n",
  "modules/a/module.ts": manifestSrc("a"),
  "modules/a/Page.tsx": pageSrc,
  "modules/a/routes.ts": routesSrc("a", "/a"),
  "modules/a/a.contract.ts": contractSrc("a", "/a"),
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/Page.tsx": pageSrc,
  "modules/c/routes.ts": routesSrc("c", "/"),
  "modules/c/c.contract.ts": contractSrc("c", "/"),
});

function build(dir: string, env: Record<string, string>): number | null {
  const clean: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k.startsWith("KEEL_PEER_")) continue;
    clean[k] = v;
  }
  return spawnSync(process.execPath, [BIN, "build", "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...clean, ...env },
  }).status;
}

const directivesOf = (policy: string): string[] =>
  policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "");

let plain = "";
let withPeer = "";
beforeAll(() => {
  plain = materialize(files());
  withPeer = materialize(files());
}, SLOW);
afterAll(() => {
  cleanup(plain);
  cleanup(withPeer);
});

describe("k.security: csp.txt of a client deployable", () => {
  test(
    "`keel build` of a fixture with a `client` deployable writes its `csp.txt` with `script-src 'self'`",
    () => {
      expect(build(plain, {})).toBe(0);
      const file = join(plain, "dist", "w", "csp.txt");
      expect(existsSync(file)).toBe(true);
      const ds = directivesOf(readFileSync(file, "utf8"));
      expect(ds).toContain("script-src 'self'");
    },
    SLOW,
  );

  test(
    "`csp.txt` is the document policy with no nonce, no `strict-dynamic` nonce source and no report directives",
    () => {
      expect(build(plain, {})).toBe(0);
      const text = readFileSync(join(plain, "dist", "w", "csp.txt"), "utf8");
      expect(text).not.toContain("nonce-");
      expect(text).not.toContain("report-uri");
      expect(text).not.toContain("report-to");
      const ds = directivesOf(text);
      for (const d of [
        "default-src 'none'",
        "style-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "require-trusted-types-for 'script'",
        "trusted-types keel",
      ]) {
        expect(ds).toContain(d);
      }
    },
    SLOW,
  );

  test(
    "`connect-src` of `csp.txt` adds each `keel-peer` origin",
    () => {
      expect(build(withPeer, { KEEL_PEER_API: "https://api.test" })).toBe(0);
      const ds = directivesOf(readFileSync(join(withPeer, "dist", "w", "csp.txt"), "utf8"));
      const connect = ds.find((d) => d.startsWith("connect-src ")) ?? "";
      expect(connect.split(" ")).toEqual(["connect-src", "'self'", "https://api.test"]);
    },
    SLOW,
  );
});
