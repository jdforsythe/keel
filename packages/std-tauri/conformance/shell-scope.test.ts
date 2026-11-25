// Spec: std.tauri, Conformance "`tauri.conf.json` holds `plugins.http.scopeRedirects` `true`. With no `identity.ts`, `Cargo.toml` names `tauri-plugin-deep-link` and `tauri-plugin-single-instance` and not `tauri-plugin-opener`, `src/lib.rs` starts both, and `capabilities/default.json` holds `deep-link:default` and no opener permission; with `identity.ts`, the opener in all three."
// Spec: std.tauri, Conformance "A build with `KEEL_ORIGIN=https://golden-1.example` of a deployable declaring `origins.connect` `https://api.example` writes a `capabilities/http.json` whose http permission allows exactly `https://golden-1.example/*` and `https://api.example/*`. The target's `plugins` is `[]` with `identity` true and false."
// Seed: 1337 (the declared origins of the property are generated).
// The real binary over a temp project. ASSUMPTIONS: "starts" a plugin is `lib.rs` naming its crate (`tauri_plugin_deep_link`, `tauri_plugin_single_instance`, `tauri_plugin_opener`);
// "the opener in all three" for `default.json` is the string `opener:` in it; the http permission's allowed URLs are the strings of `capabilities/http.json` that are `http:` or `https:` URLs;
// "`plugins` is `[]`" is read from `keel check`: a project whose `dependencies` hold `@keel/std-tauri` alone has no E1572, with and without `identity.ts`.
// Fake tools for the `dist` build: `cargo`, `rustc`, `pkg-config` and an `npx` that hands `vite` to the real `npx` and answers `tauri` with success.
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
import { cleanup, diags, keel, materialize, readText } from "./compat-support.ts";

const SLOW = 300_000;
const SEED = 1337;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const SELF = "https://golden-1.example";

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const topo = (opts: { identity?: boolean; origins?: string }): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client'${opts.identity ? ", servedBy: 'api'" : ""}, shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }${opts.origins ? `, origins: ${opts.origins}` : ""} },\n  api: { modules: [], adapter: 'node' },\n})\n`;
const IDENTITY: Record<string, string> = {
  "identity.ts": "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n",
  "identity.server.ts":
    "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n",
};
const files = (opts: { identity?: boolean; origins?: string }): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" }, devDependencies: { "@tauri-apps/cli": "2.0.0" } })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts": topo(opts),
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/Page.tsx":
    "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>home</Text>\n    </Box>\n  )\n}\n",
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
  ...(opts.identity ? IDENTITY : {}),
});
const declared = (hosts: readonly string[]): string =>
  `{ connect: { ${hosts.map((h) => `'https://${h}.example': 'r'`).join(", ")} } }`;

const dirs: string[] = [];
const made = (opts: { identity?: boolean; origins?: string }): string => {
  const dir = materialize(files(opts));
  dirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const exe = (path: string, body: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
};
let scratch = "";
let realNpx = "";
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "keel-scope-"));
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
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** `keel build --target tauri` over fake tools with `KEEL_ORIGIN` as given. */
function buildTarget(dir: string, origin: string): number | null {
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
  env.KEEL_ORIGIN = origin;
  const r = spawnSync(process.execPath, [BIN, "build", "--target", "tauri", "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: testTime(240_000),
  });
  return r.status;
}

/** Every string in a JSON value. */
const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (typeof v === "object" && v !== null) for (const x of Object.values(v)) strings(x, out);
  return out;
};

describe("std.tauri: redirect scope, plugin crates and the http permission", () => {
  test(
    "`tauri.conf.json` holds `plugins.http.scopeRedirects` `true`",
    () => {
      const dir = made({});
      expect(keel(dir, ["build"]).status).toBe(0);
      const conf: unknown = JSON.parse(readText(dir, "deploy/web/tauri/tauri.conf.json"));
      const http =
        typeof conf === "object" && conf !== null
          ? Reflect.get(Object(Reflect.get(conf, "plugins")), "http")
          : undefined;
      expect(Reflect.get(Object(http), "scopeRedirects")).toBe(true);
    },
    SLOW,
  );

  test(
    "with no `identity.ts`, `Cargo.toml` names `tauri-plugin-deep-link` and `tauri-plugin-single-instance` and not `tauri-plugin-opener`, `src/lib.rs` starts both, and `capabilities/default.json` holds `deep-link:default` and no opener permission",
    () => {
      const dir = made({});
      expect(keel(dir, ["build"]).status).toBe(0);
      const cargo = readText(dir, "deploy/web/tauri/Cargo.toml");
      expect(cargo).toContain("tauri-plugin-deep-link");
      expect(cargo).toContain("tauri-plugin-single-instance");
      expect(cargo).not.toContain("tauri-plugin-opener");
      const lib = readText(dir, "deploy/web/tauri/src/lib.rs");
      expect(lib).toContain("tauri_plugin_deep_link");
      expect(lib).toContain("tauri_plugin_single_instance");
      expect(lib).not.toContain("tauri_plugin_opener");
      const perms = readText(dir, "deploy/web/tauri/capabilities/default.json");
      expect(perms).toContain("deep-link:default");
      expect(perms).not.toContain("opener");
    },
    SLOW,
  );

  test(
    "with `identity.ts`, the opener is in `Cargo.toml`, `src/lib.rs` and `capabilities/default.json`, beside the deep-link and single-instance plugins",
    () => {
      const dir = made({ identity: true });
      expect(keel(dir, ["build"]).status).toBe(0);
      const cargo = readText(dir, "deploy/web/tauri/Cargo.toml");
      for (const crate of ["tauri-plugin-deep-link", "tauri-plugin-single-instance", "tauri-plugin-opener"])
        expect(cargo).toContain(crate);
      const lib = readText(dir, "deploy/web/tauri/src/lib.rs");
      for (const crate of ["tauri_plugin_deep_link", "tauri_plugin_single_instance", "tauri_plugin_opener"])
        expect(lib).toContain(crate);
      const perms = readText(dir, "deploy/web/tauri/capabilities/default.json");
      expect(perms).toContain("deep-link:default");
      expect(perms).toContain("opener:");
    },
    SLOW,
  );

  test(
    "a build with `KEEL_ORIGIN=https://golden-1.example` of a deployable declaring `origins.connect` `https://api.example` writes a `capabilities/http.json` whose http permission allows exactly `https://golden-1.example/*` and `https://api.example/*`",
    () => {
      const dir = made({ origins: declared(["api"]) });
      expect(buildTarget(dir, SELF)).toBe(0);
      const urls = strings(
        JSON.parse(readFileSync(join(dir, "dist", "web", "tauri", "capabilities", "http.json"), "utf8")),
      ).filter((x) => /^https?:\/\//.test(x));
      expect(urls.sort()).toEqual([`${SELF}/*`, "https://api.example/*"].sort());
    },
    SLOW,
  );

  test(
    "`capabilities/http.json` allows `<origin>/*` of the origin and each declared `connect` origin and no other URL",
    () => {
      fc.assert(
        fc.property(fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), { maxLength: 3 }), (hosts) => {
          const dir = made(hosts.length === 0 ? {} : { origins: declared(hosts) });
          expect(buildTarget(dir, SELF)).toBe(0);
          const urls = strings(
            JSON.parse(readFileSync(join(dir, "dist", "web", "tauri", "capabilities", "http.json"), "utf8")),
          ).filter((x) => /^https?:\/\//.test(x));
          expect(urls.sort()).toEqual([`${SELF}/*`, ...hosts.map((h) => `https://${h}.example/*`)].sort());
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW * 2,
  );

  test(
    "the target's `plugins` is `[]` with `identity` true and false: `keel check` with `@keel/std-tauri` alone in `dependencies` reports no E1572",
    () => {
      for (const identity of [false, true]) {
        const dir = made({ identity });
        expect(diags(keel(dir, ["check"]), "E1572")).toEqual([]);
      }
    },
    SLOW,
  );
});
