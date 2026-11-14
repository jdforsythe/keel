// Spec: k.shell, Conformance "The `www` entry a shell build writes creates its ctx with `mode: 'shell'` and the package's drivers; the plain `client` entry is unchanged."
// Seed: 1337.
// UNTESTABLE without a native toolchain, as far as the public surface shows: the `www` entry exists only after `keel build --target tauri`, whose toolchain
// step (E1575) runs first and whose last step runs `tauri build`; the compiler exports no entry generator for a shell. This body runs that build and reads
// `dist/web/tauri/www/`; it needs Rust 1.95 and `KEEL_ORIGIN`. "The package's drivers" is read as `drivers` passed to `createCtx` beside `mode: 'shell'`.
import { spawnSync } from "node:child_process";
import {
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SLOW = 600_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const tree: Record<string, string> = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" } })}\n`,
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
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "keel-shell-entry-"));
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
}, SLOW);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function build(args: string[]): number | null {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_") || k === "NODE_OPTIONS" || k === "TEST")
      continue;
    env[k] = v;
  }
  env["KEEL_ORIGIN"] = "https://app.example";
  return spawnSync(process.execPath, [BIN, "build", ...args, "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: 540_000,
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
const SHELL_CTX = /mode\s*:\s*["']shell["']/;
const joined = (m: Map<string, string>): string => [...m.values()].join("\n");

describe("k.shell: the shell entry", () => {
  test.skip(
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
