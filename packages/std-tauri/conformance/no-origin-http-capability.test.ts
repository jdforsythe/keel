// Spec: std.tauri, Conformance "With `web` alone (no `node` deployable) and no `KEEL_ORIGIN`, a build after one with an `api` deployable and `KEEL_ORIGIN=https://golden-1.example` leaves no `capabilities/http.json` in `dist/web/tauri/`; declaring `origins.connect` `https://api.example`, one whose http permission allows exactly `https://api.example/*`."
// Spec: std.tauri, Build "With no `origin` ... it lists the `connect` origins alone; with none of those either, the build writes no `capabilities/http.json` and removes one an earlier build left in `dir`"
// Seed: 1337 (the declared origins of the property are generated).
// The real binary over a temp project and fake tools, as shell-scope.test.ts. ASSUMPTIONS: the http permission's allowed URLs are the strings of `capabilities/http.json` that are `http:` or `https:` URLs;
// the earlier build is the clause's (with `api` and `KEEL_ORIGIN`), and a stale file is also put into `dist/web/tauri/capabilities/` by hand before the later build, for a build that does not empty `dir`.
import { testTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const SEED = 1337;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const SELF = "https://golden-1.example";

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const topo = (server: boolean, origins?: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }${origins === undefined ? "" : `, origins: ${origins}`} },\n${server ? "  api: { modules: [], adapter: 'node' },\n" : ""}})\n`;
const declared = (hosts: readonly string[]): string =>
  `{ connect: { ${hosts.map((h) => `'https://${h}.example': 'r'`).join(", ")} } }`;
const files = (): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" }, devDependencies: { "@tauri-apps/cli": "2.0.0" } })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts": topo(true),
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/Page.tsx":
    "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>home</Text>\n    </Box>\n  )\n}\n",
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
});

const dirs: string[] = [];
const exe = (path: string, body: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
};
let scratch = "";
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "keel-noorigin-"));
  let realNpx = "";
  for (const d of (process.env.PATH ?? "").split(delimiter)) {
    if (d !== "" && existsSync(join(d, "npx"))) {
      realNpx = join(d, "npx");
      break;
    }
  }
  const bin = join(scratch, "bin");
  exe(join(bin, "cargo"), 'echo "cargo 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "rustc"), 'echo "rustc 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "pkg-config"), "exit 0\n");
  exe(
    join(bin, "npx"),
    `for a in "$@"; do\n  case "$a" in\n    vite) exec "${realNpx}" "$@" ;;\n    tauri) exit 0 ;;\n  esac\ndone\nexec "${realNpx}" "$@"\n`,
  );
}, SLOW);
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
  for (const d of dirs) cleanup(d);
});

/** `keel build --target tauri` over fake tools; `origin` undefined leaves `KEEL_ORIGIN` unset. */
function build(dir: string, origin: string | undefined): number | null {
  const stub = join(dir, "node_modules", "@tauri-apps", "cli");
  mkdirSync(stub, { recursive: true });
  writeFileSync(join(stub, "package.json"), '{ "name": "@tauri-apps/cli", "version": "1.0.0" }\n');
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  if (!existsSync(join(dir, "node_modules", ".bin", "vite")))
    symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(dir, "node_modules", ".bin", "vite"));
  exe(join(dir, "node_modules", ".bin", "tauri"), "exit 0\n");
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "PATH") continue;
    env[k] = v;
  }
  env.PATH = [join(scratch, "bin"), dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter);
  if (origin !== undefined) env.KEEL_ORIGIN = origin;
  return spawnSync(process.execPath, [BIN, "build", "--target", "tauri", "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: testTime(240_000),
  }).status;
}
const HTTP = (dir: string): string => join(dir, "dist", "web", "tauri", "capabilities", "http.json");
const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (typeof v === "object" && v !== null) for (const x of Object.values(v)) strings(x, out);
  return out;
};
const allowed = (dir: string): string[] =>
  strings(JSON.parse(readFileSync(HTTP(dir), "utf8"))).filter((x) => /^https?:\/\//.test(x));
/** A project built once with `api` and an origin (which writes the grant), then turned into `web` alone. */
function afterServerBuild(origins?: string): string {
  const dir = materialize(files());
  dirs.push(dir);
  expect(build(dir, SELF)).toBe(0);
  expect(allowed(dir)).toEqual([`${SELF}/*`]);
  writeFileSync(join(dir, "topology.ts"), topo(false, origins));
  return dir;
}

describe("std.tauri: capabilities/http.json with no origin", () => {
  test(
    "with `web` alone and no `KEEL_ORIGIN`, a build after one with an `api` deployable and `KEEL_ORIGIN=https://golden-1.example` leaves no `capabilities/http.json` in `dist/web/tauri/`",
    () => {
      const dir = afterServerBuild();
      expect(build(dir, undefined)).toBe(0);
      expect(existsSync(HTTP(dir))).toBe(false);
    },
    SLOW,
  );

  test(
    "with no `origin` and no `connect` origin, a `capabilities/http.json` an earlier build left in `dir` is removed",
    () => {
      const dir = afterServerBuild();
      mkdirSync(dirname(HTTP(dir)), { recursive: true });
      writeFileSync(
        HTTP(dir),
        JSON.stringify({ permissions: [{ identifier: "http:default", allow: [{ url: `${SELF}/*` }] }] }),
      );
      expect(build(dir, "")).toBe(0);
      expect(existsSync(HTTP(dir))).toBe(false);
    },
    SLOW,
  );

  test(
    "with `web` alone declaring `origins.connect` `https://api.example` and no `KEEL_ORIGIN`, the http permission of `capabilities/http.json` allows exactly `https://api.example/*`",
    () => {
      const dir = afterServerBuild(declared(["api"]));
      expect(build(dir, undefined)).toBe(0);
      expect(allowed(dir)).toEqual(["https://api.example/*"]);
    },
    SLOW,
  );

  test(
    "with no `origin`, the http permission allows `<o>/*` for each declared `connect` origin and no other URL",
    () => {
      fc.assert(
        fc.property(fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), { minLength: 1, maxLength: 3 }), (hosts) => {
          const dir = afterServerBuild(declared(hosts));
          expect(build(dir, undefined)).toBe(0);
          expect(allowed(dir).sort()).toEqual(hosts.map((h) => `https://${h}.example/*`).sort());
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW * 2,
  );
});
