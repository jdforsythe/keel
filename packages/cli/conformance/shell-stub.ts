// Fixture for the k.shell conformance over a stub shell package (not a test file). Public surface only: the `keel` binary over a temp project.
// The project declares `tauri` on `web` (`client`); `node_modules/@keel/std-tauri` is replaced by a stub package whose `./tools` entry registers a target.
// The stub reads `stub.json` at the project root, so a test shapes the target without touching the stub:
//   { register?: false, platforms?, files?, tools?, build?, jobs? }  (defaults: registers, `platforms: []`, `files: { "a.json": ... }`, no tool entries, an `artifact`, no jobs)
// Each call of the target's `build` appends one JSON line to `build-calls.txt` of the project: `{ dir, origin, platform, release, www, a }` (`www` and `a`: whether `www/index.html` and `a.json` were already in `dir`).
// The stub is plain JavaScript (a `.ts` file under `node_modules` is not run by Node); its `.` and `./shellMount` re-export the real package's drivers and `shellMount`, so the shell entry bundles.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Rec, type Run, cleanup, materialize } from "./compat-support.ts";

export { cleanup };
export const SLOW = 300_000;
export const SEED = 1337;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const REAL = join(REPO, "packages", "std-tauri", "src");

export type StubJob = {
  job: string;
  runsOn?: string;
  platform?: string;
  manual: boolean;
  steps?: string[];
  env?: Record<string, string>;
  artifact?: string;
};
export type StubConfig = {
  register?: boolean;
  platforms?: string[];
  files?: Record<string, string>;
  tools?: { tool: string; need: string }[];
  build?: { artifact: string } | { error: string };
  jobs?: StubJob[];
};

export const ORIGIN = "https://app.example";
export const A_JSON = '{"key":"abcdefghijkl"}\n';

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
export const topologySrc = (shell: boolean): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client'${shell ? ", shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }" : ""} },\n})\n`;

const TOOLS_JS = `import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { shellTarget } from "@keel/cli";

const cfg = JSON.parse(readFileSync(join(process.cwd(), "stub.json"), "utf8"));
if (cfg.register !== false) {
  shellTarget("tauri", {
    platforms: cfg.platforms ?? [],
    files: () => cfg.files ?? { "a.json": ${JSON.stringify(A_JSON)} },
    tools: () => cfg.tools ?? [],
    build: (at) => {
      appendFileSync(
        join(process.cwd(), "build-calls.txt"),
        JSON.stringify({
          dir: at.dir,
          origin: at.origin,
          platform: at.platform ?? null,
          release: at.release,
          www: existsSync(join(at.dir, "www", "index.html")),
          a: existsSync(join(at.dir, "a.json")),
        }) + "\\n",
      );
      return cfg.build ?? { artifact: "dist/web/tauri/target/debug/stub" };
    },
    ci: () => cfg.jobs ?? [],
  });
}
`;

/** A project declaring `tauri` on `web`, with the stub as `@keel/std-tauri`. */
export function stubProject(cfg: StubConfig = {}): string {
  const dir = materialize({
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" } })}\n`,
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
    "topology.ts": topologySrc(true),
    "modules/c/module.ts": manifestSrc("c"),
    "modules/c/Page.tsx":
      "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>home</Text>\n    </Box>\n  )\n}\n",
    "modules/c/routes.ts":
      "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nexport const routes = manifest({ 'c.page': { path: '/', component: Page } })\n",
    "stub.json": JSON.stringify(cfg),
  });
  const stub = join(dir, "node_modules", "@keel", "std-tauri");
  rmSync(stub, { recursive: true, force: true });
  mkdirSync(stub, { recursive: true });
  writeFileSync(
    join(stub, "package.json"),
    JSON.stringify({
      name: "@keel/std-tauri",
      version: "0.0.0",
      type: "module",
      exports: { ".": "./index.js", "./shellMount": "./shellMount.js", "./tools": "./tools.js" },
    }),
  );
  writeFileSync(join(stub, "index.js"), `export * from ${JSON.stringify(join(REAL, "index.ts"))};\n`);
  writeFileSync(join(stub, "shellMount.js"), `export * from ${JSON.stringify(join(REAL, "shellMount.ts"))};\n`);
  writeFileSync(join(stub, "tools.js"), TOOLS_JS);
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(dir, "node_modules", ".bin", "vite"));
  return dir;
}

export function setStub(dir: string, cfg: StubConfig): void {
  writeFileSync(join(dir, "stub.json"), JSON.stringify(cfg));
}

export type Out = Run & { out: string };

/** `keel <args>` with `KEEL_ORIGIN` set (or not), JSON records and the whole output text. */
export function run(dir: string, args: readonly string[], origin: string | undefined = ORIGIN, format = "json"): Out {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  if (origin !== undefined) env["KEEL_ORIGIN"] = origin;
  const r = spawnSync(process.execPath, [BIN, ...args, `--format=${format}`], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: 240_000,
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
  return { status: r.status, records, out: `${r.stdout}\n${r.stderr}` };
}

export const withCode = (r: Run, code: string): Rec[] => r.records.filter((x) => x.kind === "diag" && x.code === code);
export const buildCalls = (dir: string): Record<string, unknown>[] => {
  const file = join(dir, "build-calls.txt");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => JSON.parse(l));
};
