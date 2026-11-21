// Spec: std.tauri, Conformance "With no `cargo` on `PATH`, `keel build --target tauri` prints one E1575 naming `cargo` and Rust 1.95, exits 1 and writes nothing under `dist/web/tauri/`."
// Spec: k.shell, Rules "E1575 a shell build's tool missing or too old (names it and the version needed)"
// Seed: 1337.
// No native tool runs: `PATH` is a directory (or several) that holds no executable, so the toolchain step (k.shell Build 3, before any work) reports the missing tool.
// UNTESTABLE without a tool: "too old" (the spec does not say how a version is read, and any reading means running a tool); the Capacitor, Gradle and Xcode toolchains (JDK 21, Android SDK, Xcode 26): the spec does not say how they are found.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Rec, cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const files = (): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" } })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n})\n",
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nconst Page = () => null\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
});

let project = "";
let scratch = "";
beforeAll(() => {
  project = materialize(files());
  scratch = mkdtempSync(join(tmpdir(), "keel-no-cargo-"));
}, SLOW);
afterAll(() => {
  cleanup(project);
  rmSync(scratch, { recursive: true, force: true });
});

/** `keel build --target tauri` with a valid `KEEL_ORIGIN` and `PATH` made of `dirs` (none holds a tool). */
function build(dirs: readonly string[]): { status: number | null; records: Rec[] } {
  const empty = join(scratch, "home");
  mkdirSync(empty, { recursive: true });
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "PATH") continue;
    env[k] = v;
  }
  Object.assign(env, {
    PATH: dirs.join(":"),
    HOME: empty,
    CARGO_HOME: empty,
    RUSTUP_HOME: empty,
    KEEL_ORIGIN: "https://app.example",
  });
  const r = spawnSync(process.execPath, [BIN, "build", "--target", "tauri", "--format=json"], {
    cwd: project,
    encoding: "utf8",
    env,
    timeout: 120_000,
  });
  const records: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string")
        records.push({ ...v, kind: v.kind });
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, records };
}
const e1575 = (run: { records: Rec[] }): Rec[] => run.records.filter((r) => r.kind === "diag" && r.code === "E1575");
const naming = (run: { records: Rec[] }, word: string): Rec[] =>
  e1575(run).filter((r) => String(r.message).includes(word));

const dirNames = fc.uniqueArray(fc.stringMatching(/^[a-z]{3,8}$/), { minLength: 0, maxLength: 3 });

describe("std.tauri: E1575", () => {
  test(
    "With no `cargo` on `PATH`, `keel build --target tauri` prints one E1575 naming `cargo` and Rust 1.95, exits 1 and writes nothing under `dist/web/tauri/`.",
    () => {
      const run = build([join(scratch, "empty")]);
      expect(naming(run, "cargo")).toHaveLength(1);
      expect(String(naming(run, "cargo")[0]?.message)).toContain("1.95");
      expect(run.status).toBe(1);
      expect(existsSync(join(project, "dist", "web", "tauri"))).toBe(false);
    },
    SLOW,
  );

  test(
    "E1575 a shell build's tool missing or too old (names it and the version needed)",
    () => {
      fc.assert(
        fc.property(dirNames, (names) => {
          const dirs = names.map((n) => join(scratch, n));
          for (const d of dirs) mkdirSync(d, { recursive: true });
          const run = build(dirs);
          expect(naming(run, "cargo")).toHaveLength(1);
          expect(String(naming(run, "cargo")[0]?.message)).toContain("1.95");
          expect(run.status).toBe(1);
          expect(existsSync(join(project, "dist", "web", "tauri"))).toBe(false);
        }),
        { seed: 1337, numRuns: 3 },
      );
    },
    SLOW,
  );
});
