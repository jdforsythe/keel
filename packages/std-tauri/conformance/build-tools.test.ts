// std.tauri, Files "`icons/icon.png` there is the app's own, committed and not generated; without one the build uses Keel's mark."
// Spec: std.tauri, clause "A build runs `tauri build --debug --no-bundle` in `dist/web/tauri/`, beside `www/`, with `capabilities/http.json` allowing `KEEL_ORIGIN`; without `icons/icon.png` in `deploy/web/tauri/` it writes Keel's mark there, with one it copies the app's."
// Seed: 1337.
// Fake tools: `PATH` holds a `cargo`, a `rustc` and an `npx` written by the test. The fake `npx` hands `vite` to the real
// `npx` (the web build runs for real) and records the arguments and working directory of `tauri`.
// Assumption: the Tauri tool is run as `npx ... tauri build ...` (the spec names the tool, not the runner).
// AMBIGUOUS: "writes Keel's mark there": `there` read as the build folder `dist/web/tauri/icons/icon.png` (std.tauri Build: "into `dir`"); that `deploy/web/tauri/icons/icon.png` stays absent is kept from "committed and not generated".
// UNTESTABLE: that `capabilities/http.json` allows `KEEL_ORIGIN` only (the spec gives no permission shape): asserted as "`capabilities/http.json` mentions the origin".
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
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Rec, cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const ORIGIN = "https://app.example";

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const PKG = `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" }, devDependencies: { "@tauri-apps/cli": "2.0.0" } })}\n`;
const files = (): Record<string, string> => ({
  "package.json": PKG,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n  api: { modules: [], adapter: 'node' },\n})\n",
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/Page.tsx":
    "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>home</Text>\n    </Box>\n  )\n}\n",
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
});

/** Any small valid RGB PNG (8-bit, color type 2, 1x1), so it differs from Keel's RGBA mark. */
const OWN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let project = "";
let scratch = "";
let realNpx = "";
beforeAll(() => {
  project = materialize(files());
  for (const pkg of ["@tauri-apps/cli"]) {
    mkdirSync(join(project, "node_modules", pkg), { recursive: true });
    writeFileSync(join(project, "node_modules", pkg, "package.json"), `{ "name": "${pkg}", "version": "1.0.0" }\n`);
  }
  mkdirSync(join(project, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(project, "node_modules", ".bin", "vite"));
  for (const bin of ["tauri"]) exe(join(project, "node_modules", ".bin", bin), "exit 0\n");
  scratch = mkdtempSync(join(tmpdir(), "keel-tools-"));
  for (const d of (process.env.PATH ?? "").split(delimiter)) {
    if (d !== "" && existsSync(join(d, "npx"))) {
      realNpx = join(d, "npx");
      break;
    }
  }
}, SLOW);
afterAll(() => {
  cleanup(project);
  rmSync(scratch, { recursive: true, force: true });
});

function exe(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
}

/** The fake tool layer: `bin/` for `PATH`, `log/` for what the fake tools saw. Returns the env to build with. */
function tools(tauriBody: string): { env: Record<string, string>; log: string } {
  const root = mkdtempSync(join(scratch, "t-"));
  const bin = join(root, "bin");
  const log = join(root, "log");
  mkdirSync(log, { recursive: true });
  exe(join(bin, "cargo"), 'echo "cargo 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "rustc"), 'echo "rustc 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "pkg-config"), "exit 0\n");
  exe(join(root, "tauri.sh"), tauriBody);
  exe(
    join(bin, "npx"),
    `for a in "$@"; do
  case "$a" in
    vite) exec "${realNpx}" "$@" ;;
    tauri) echo "$@" >> "${log}/tauri.txt"; pwd >> "${log}/tauri-cwd.txt"; exec sh "${root}/tauri.sh" ;;
  esac
done
exec "${realNpx}" "$@"
`,
  );
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "PATH") continue;
    env[k] = v;
  }
  Object.assign(env, {
    PATH: [bin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    KEEL_ORIGIN: ORIGIN,
  });
  return { env, log };
}

function build(
  args: readonly string[],
  env: Record<string, string>,
): { status: number | null; out: string; records: Rec[] } {
  const r = spawnSync(process.execPath, [BIN, "build", ...args, "--format=json"], {
    cwd: project,
    encoding: "utf8",
    env,
    timeout: testTime(240_000),
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
  return { status: r.status, out: `${r.stdout}\n${r.stderr}`, records };
}

const tauriDir = (): string => join(project, "deploy", "web", "tauri");
const distTauri = (): string => join(project, "dist", "web", "tauri");
const reset = (): void => {
  rmSync(join(project, "dist"), { recursive: true, force: true });
  rmSync(join(tauriDir(), "icons"), { recursive: true, force: true });
};

describe("std.tauri: build", () => {
  test(
    "`icons/icon.png` there is the app's own, committed and not generated; without one the build uses Keel's mark.",
    () => {
      reset();
      const none = tools("exit 0\n");
      const a = build(["--target", "tauri"], none.env);
      expect(a.status).toBe(0);
      const mark = readFileSync(join(distTauri(), "icons", "icon.png"));
      expect(mark.subarray(0, 8).equals(SIGNATURE)).toBe(true);
      expect(mark.subarray(12, 16).toString("latin1")).toBe("IHDR");
      expect(mark[25]).toBe(6);
      expect(existsSync(join(tauriDir(), "icons", "icon.png"))).toBe(false);

      reset();
      mkdirSync(join(tauriDir(), "icons"), { recursive: true });
      writeFileSync(join(tauriDir(), "icons", "icon.png"), OWN_PNG);
      const own = tools("exit 0\n");
      const b = build(["--target", "tauri"], own.env);
      expect(b.status).toBe(0);
      expect(readFileSync(join(distTauri(), "icons", "icon.png")).equals(OWN_PNG)).toBe(true);
      expect(readFileSync(join(tauriDir(), "icons", "icon.png")).equals(OWN_PNG)).toBe(true);
      reset();
    },
    SLOW,
  );

  test(
    "A build runs `tauri build --debug --no-bundle` in `dist/web/tauri/`, beside `www/`, with `capabilities/http.json` allowing `KEEL_ORIGIN`.",
    () => {
      reset();
      const t = tools("exit 0\n");
      const r = build(["--target", "tauri"], t.env);
      expect(r.status).toBe(0);
      expect(existsSync(join(distTauri(), "www", "index.html"))).toBe(true);
      const args = readFileSync(join(t.log, "tauri.txt"), "utf8");
      expect(args).toContain("tauri");
      expect(args).toContain("build --debug --no-bundle");
      expect(readFileSync(join(t.log, "tauri-cwd.txt"), "utf8").trim().endsWith("dist/web/tauri")).toBe(true);
      const caps = join(distTauri(), "capabilities", "http.json");
      expect(existsSync(caps)).toBe(true);
      expect(readFileSync(caps, "utf8")).toContain(ORIGIN);
      reset();
    },
    SLOW,
  );

  test(
    "without `icons/icon.png` in `deploy/web/tauri/` it writes Keel's mark there, with one it copies the app's.",
    () => {
      reset();
      const none = tools("exit 0\n");
      expect(build(["--target", "tauri"], none.env).status).toBe(0);
      const mark = readFileSync(join(distTauri(), "icons", "icon.png"));
      expect(mark.subarray(0, 8).equals(SIGNATURE)).toBe(true);
      expect(mark[25]).toBe(6);
      reset();
      mkdirSync(join(tauriDir(), "icons"), { recursive: true });
      writeFileSync(join(tauriDir(), "icons", "icon.png"), OWN_PNG);
      expect(build(["--target", "tauri"], tools("exit 0\n").env).status).toBe(0);
      expect(readFileSync(join(distTauri(), "icons", "icon.png")).equals(OWN_PNG)).toBe(true);
      reset();
    },
    SLOW,
  );
});
