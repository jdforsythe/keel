// Spec: k.shell, Conformance "The `www` entry of a project with no `identity.ts` calls the package's `shellMount` with the shell's `id` and no `mount`, before the router starts; with `identity.ts`, with its default export as `mount`."
// Seed: 1337 (no random input; the two projects are fixed).
// Builds two fixtures as shell-entry.test.ts does (fake `cargo`, `rustc`, `npx`, `tauri`), one without and one with `identity.ts`, and reads the `www` bundle the shell build writes.
// ASSUMED: the bundle is minified, so `shellMount` is found by its argument object: `{ id: 'dev.keel.golden', origin: ... }` and a `mount` key in that object or not.
// "Before the router starts" is untestable from the bundle text without running the entry; it is not asserted.
// SKIPPED until the RFC 0189 build lands (`entryCode` calls `shellMount` without `identity.ts`). To un-skip: change `test.skip` to `test` below.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SLOW = 180_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const tree: Record<string, string> = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" }, devDependencies: { "@tauri-apps/cli": "2.0.0" } })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "index.html":
    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>fx</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/@keel/entry.ts"></script>\n  </body>\n</html>\n',
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n  api: { modules: [], adapter: 'node' },\n})\n",
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nimport { Text } from '@keel/ui'\nconst Page = () => Text({ children: 'x' })\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
};

const identityFiles: Record<string, string> = {
  "identity.ts": "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n",
  "identity.server.ts":
    "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n",
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', servedBy: 'api', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n  api: { modules: [], adapter: 'node' },\n})\n",
};
const dirs: string[] = [];
let scratch = "";
let fakeBin = "";
let realNpx = "";

function exe(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
}

function project(extra: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-shell-mount-"));
  dirs.push(dir);
  for (const [p, c] of Object.entries({ ...tree, ...extra })) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  }
  for (const name of ["vitest", "vite", "typescript", "fast-check"]) {
    symlinkSync(join(REPO, "node_modules", name), join(dir, "node_modules", name));
  }
  mkdirSync(join(dir, "node_modules", "@tauri-apps", "cli"), { recursive: true });
  writeFileSync(
    join(dir, "node_modules", "@tauri-apps", "cli", "package.json"),
    '{ "name": "@tauri-apps/cli", "version": "1.0.0" }\n',
  );
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(dir, "node_modules", ".bin", "vite"));
  exe(join(dir, "node_modules", ".bin", "tauri"), "exit 0\n");
  return dir;
}

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "keel-shell-tools-"));
  for (const d of (process.env.PATH ?? "").split(delimiter)) {
    if (d !== "" && existsSync(join(d, "npx"))) {
      realNpx = join(d, "npx");
      break;
    }
  }
  fakeBin = join(scratch, "bin");
  exe(join(fakeBin, "cargo"), 'echo "cargo 1.99.0 (fake 2030-01-01)"\n');
  exe(join(fakeBin, "rustc"), 'echo "rustc 1.99.0 (fake 2030-01-01)"\n');
  exe(join(fakeBin, "pkg-config"), "exit 0\n");
  exe(
    join(fakeBin, "npx"),
    `for a in "$@"; do
  case "$a" in
    vite) exec "${realNpx}" "$@" ;;
    tauri) exit 0 ;;
  esac
done
exec "${realNpx}" "$@"
`,
  );
}, SLOW);
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
});

function shellBuild(dir: string): string {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "PATH") continue;
    env[k] = v;
  }
  Object.assign(env, {
    PATH: [fakeBin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    KEEL_ORIGIN: "https://app.example",
  });
  const r = spawnSync(process.execPath, [BIN, "build", "--target", "tauri", "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: 150_000,
  });
  expect(r.status, r.stdout + r.stderr).toBe(0);
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d).sort()) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.m?js$/.test(e)) out.push(readFileSync(full, "utf8"));
    }
  };
  walk(join(dir, "dist", "web", "tauri", "www"));
  return out.join("\n");
}

/** The argument object of the `shellMount` call: the one holding the shell's `id` and an `origin`. */
function shellMountArg(text: string): string | null {
  const m =
    /\{[^{}]*\bid\s*:\s*["'`]dev\.keel\.golden["'`][^{}]*\borigin\s*:[^{}]*\}|\{[^{}]*\borigin\s*:[^{}]*\bid\s*:\s*["'`]dev\.keel\.golden["'`][^{}]*\}/.exec(
      text,
    );
  return m === null ? null : m[0];
}

describe("k.shell: the shell entry calls shellMount with or without an identity source", () => {
  test(
    "The `www` entry of a project with no `identity.ts` calls the package's `shellMount` with the shell's `id` and no `mount`, before the router starts; with `identity.ts`, with its default export as `mount`.",
    () => {
      const without = shellMountArg(shellBuild(project({})));
      expect(without).not.toBeNull();
      expect(without).not.toMatch(/\bmount\s*:/);

      const withIdentity = shellMountArg(shellBuild(project(identityFiles)));
      expect(withIdentity).not.toBeNull();
      expect(withIdentity).toMatch(/\bmount\s*:/);
    },
    SLOW * 2,
  );
});
