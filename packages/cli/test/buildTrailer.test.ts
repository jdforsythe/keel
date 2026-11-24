// One trailer per `keel build`, last, after every step has settled.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "../conformance/compat-support.ts";

const BIN = new URL("../src/bin.ts", import.meta.url).pathname;
const made: string[] = [];

const project = (viteBody: string): string => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "keel-build-trailer-")));
  made.push(d);
  mkdirSync(join(d, "node_modules/.bin"), { recursive: true });
  writeFileSync(join(d, "vite.config.ts"), "export default {}\n");
  writeFileSync(join(d, "node_modules/.bin/vite"), `#!/bin/sh\n${viteBody}\n`);
  chmodSync(join(d, "node_modules/.bin/vite"), 0o755);
  return d;
};
const env = (): Record<string, string> => {
  const e: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.toLowerCase().startsWith("npm_") && k !== "KEEL_AGENT" && k !== "NODE_OPTIONS") e[k] = v;
  }
  return e;
};
const keel = (cwd: string, args: string[]): { code: number | null; lines: string[]; stdout: string } => {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, env: env(), encoding: "utf8", timeout: 100_000 });
  return { code: r.status, lines: r.stdout.split("\n").filter((l) => l !== ""), stdout: r.stdout };
};

afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe("build trailer", () => {
  test("a failing Vite build ends with one fail trailer and prints no ok build line", () => {
    const r = keel(project('echo "bad" >&2\nexit 5'), ["build"]);
    expect(r.code).toBe(1);
    expect(r.lines.at(-1)).toMatch(/^fail build /);
    expect(r.lines.filter((l) => l.startsWith("ok build"))).toEqual([]);
    expect(r.lines.filter((l) => l.startsWith("fail build"))).toHaveLength(1);
  }, 120_000);

  test("a succeeding Vite build prints one ok trailer and exits 0", () => {
    const r = keel(project("exit 0"), ["build"]);
    expect(r.code).toBe(0);
    expect(r.lines.filter((l) => l.startsWith("ok build"))).toHaveLength(1);
    expect(r.lines.at(-1)).toMatch(/^ok build /);
  }, 120_000);

  test("--format=json: a failing Vite build gives one summary item with ok false, last", () => {
    const r = keel(project("exit 5"), ["build", "--format=json"]);
    expect(r.code).toBe(1);
    const items: unknown[] = r.stdout.trim().startsWith("[") ? JSON.parse(r.stdout) : r.lines.map((l) => JSON.parse(l));
    const sums = items.filter((i) => typeof i === "object" && i !== null && "ok" in i && "counts" in i);
    expect(sums).toHaveLength(1);
    expect(items.at(-1)).toMatchObject({ ok: false, counts: { errors: 1 } });
  }, 120_000);

  test("--format=json: a succeeding build gives one summary item with ok true", () => {
    const r = keel(project("exit 0"), ["build", "--format=json"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"ok":true');
    expect(r.stdout).not.toContain('"ok":false');
  }, 120_000);

  test("--quiet on a failing Vite build prints no ok build line and exits 1", () => {
    const r = keel(project("exit 5"), ["build", "--quiet"]);
    expect(r.code).toBe(1);
    expect(r.lines.filter((l) => l.startsWith("ok build"))).toEqual([]);
    expect(r.stdout).toMatch(/fail build|^$/m);
  }, 120_000);

  test("a failing native tool after a good web build ends with one fail trailer, no ok build line, and its error on stderr", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-build-tool-")));
    made.push(root);
    const manifest =
      "import { module } from '@keel/compiler'\nexport default module({ id: 'c', deps: [], capabilities: [], public: { exports: [] } })\n";
    const app = materialize({
      "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" }, devDependencies: { "@tauri-apps/cli": "2.0.0" } })}\n`,
      "vite.config.ts":
        'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
      "tsconfig.json": JSON.stringify({
        compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
      }),
      "topology.ts":
        "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n})\n",
      "modules/c/module.ts": manifest,
      "modules/c/Page.tsx":
        "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>page</Text>\n    </Box>\n  )\n}\n",
      "modules/c/c.contract.ts":
        "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
      "modules/c/routes.ts":
        "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { c } from './c.contract.ts'\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
    });
    made.push(app);
    mkdirSync(join(app, "node_modules", "@tauri-apps", "cli"), { recursive: true });
    writeFileSync(
      join(app, "node_modules", "@tauri-apps", "cli", "package.json"),
      '{ "name": "@tauri-apps/cli", "version": "1.0.0" }\n',
    );
    mkdirSync(join(app, "node_modules", ".bin"), { recursive: true });
    symlinkSync(
      join(dirname(BIN), "..", "..", "..", "node_modules", "vite", "bin", "vite.js"),
      join(app, "node_modules", ".bin", "vite"),
    );
    writeFileSync(join(app, "node_modules", ".bin", "tauri"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(app, "node_modules", ".bin", "tauri"), 0o755);
    const bin = join(root, "bin");
    const exe = (name: string, body: string): void => {
      mkdirSync(bin, { recursive: true });
      writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
      chmodSync(join(bin, name), 0o755);
    };
    exe("cargo", 'echo "cargo 1.99.0 (fake 2030-01-01)"');
    exe("rustc", 'echo "rustc 1.99.0 (fake 2030-01-01)"');
    exe("pkg-config", "exit 0");
    const npx = (process.env.PATH ?? "")
      .split(delimiter)
      .map((d) => join(d, "npx"))
      .find((f) => existsSync(f));
    exe(
      "npx",
      `for a in "$@"; do\n  case "$a" in\n    vite) exec "${npx}" "$@" ;;\n    tauri) echo "tauri boom" >&2; exit 1 ;;\n  esac\ndone\nexec "${npx}" "$@"`,
    );
    const e = env();
    for (const k of Object.keys(e)) if (k.startsWith("VITEST") || k.startsWith("KEEL_")) delete e[k];
    e.PATH = [bin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter);
    const r = spawnSync(process.execPath, [BIN, "build", "--target", "tauri"], {
      cwd: app,
      env: e,
      encoding: "utf8",
      timeout: 200_000,
    });
    cleanup(app);
    const lines = r.stdout.split("\n").filter((l) => l !== "");
    expect(r.stderr).toContain("tauri boom");
    expect(r.status).toBe(1);
    expect(lines.at(-1)).toMatch(/^fail build /);
    expect(lines.filter((l) => l.startsWith("ok build"))).toEqual([]);
  }, 240_000);
});
