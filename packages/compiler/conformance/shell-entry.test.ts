// Spec: k.shell, Conformance "The `www` entry a shell build writes creates its ctx with `mode: 'shell'` and the package's drivers; the plain `client` entry is unchanged."
// Seed: 1337.
// The test builds a fixture whose `node_modules/.bin/tauri` and `PATH` tools (`cargo`, `rustc`, `npx`) are fakes that exit 0 without compiling, then reads
// the `www` entry the build writes. "The package's drivers" is read as `drivers` passed to `createCtx` beside `mode: 'shell'`.
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
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
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
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n})\n",
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({ 'c.page': { path: '/', component: Page } })\n",
};

let dir = "";
let scratch = "";
let fakeBin = "";
let realNpx = "";

function exe(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "keel-shell-entry-"));
  scratch = mkdtempSync(join(tmpdir(), "keel-shell-tools-"));
  for (const [p, c] of Object.entries(tree)) {
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
  rmSync(dir, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
});

function build(args: string[]): number | null {
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
  return spawnSync(process.execPath, [BIN, "build", ...args, "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: 150_000,
  }).status;
}

/** Every `.js` and `.mjs` file under `root`, path -> text. */
function scripts(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const e of readdirSync(d).sort()) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.m?js$/.test(e)) out.set(full.slice(root.length), readFileSync(full, "utf8"));
    }
  };
  walk(root);
  return out;
}
const SHELL_CTX = /mode\s*:\s*["'`]shell["'`]/;
const joined = (m: Map<string, string>): string => [...m.values()].join("\n");

describe("k.shell: the shell entry", () => {
  test(
    "The `www` entry a shell build writes creates its ctx with `mode: 'shell'` and the package's drivers; the plain `client` entry is unchanged.",
    () => {
      expect(build([])).toBe(0);
      const plainBefore = scripts(join(dir, "dist", "web"));
      expect(joined(plainBefore)).not.toMatch(SHELL_CTX);

      expect(build(["--target", "tauri"])).toBe(0);
      const www = scripts(join(dir, "dist", "web", "tauri", "www"));
      expect(www.size).toBeGreaterThan(0);
      expect(joined(www)).toMatch(SHELL_CTX);
      expect(joined(www)).toMatch(/drivers/);

      expect(build([])).toBe(0);
      const plainAfter = scripts(join(dir, "dist", "web"));
      for (const [path, text] of plainBefore) {
        if (path.startsWith("/tauri/")) continue;
        expect(plainAfter.get(path)).toBe(text);
      }
      expect(
        [...plainAfter]
          .filter(([path]) => !path.startsWith("/tauri/"))
          .map(([, t]) => t)
          .join("\n"),
      ).not.toMatch(SHELL_CTX);
    },
    SLOW,
  );
});
