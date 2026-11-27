// A `keel build` fixture with one `node` deployable `web` and no hand-written server.ts (not a test file). Seed 1337.
// Pattern of build-assets.test.ts: symlinked workspace packages, the real CLI builds it once.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const COUNTER = `import { signal } from "@keel/reactive";
import { Box, Button, Text } from "@keel/ui";
export default function Counter() {
  const n = signal(0);
  return <Box><Button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</Button><Text id="c.out">{n.get()}</Text></Box>
}
`;

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function link(target: string, at: string): void {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at);
}

/** Build the fixture with the real CLI and return its root; the caller removes it. */
export function buildNodeFixture(): string {
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-topology-")));
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server", "ui"]) {
    link(path.join(REPO, "packages", p), path.join(fixture, "node_modules", "@keel", p));
  }
  link(path.join(REPO, "node_modules", "vite"), path.join(fixture, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(fixture, "node_modules", ".bin", "vite"));
  write(fixture, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    fixture,
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["app"], adapter: "node" } });\n',
  );
  write(
    fixture,
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    fixture,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "@keel/runtime-dom",
        module: "esnext",
        target: "es2022",
        moduleResolution: "bundler",
      },
    }),
  );
  write(fixture, "modules/app/Counter.tsx", COUNTER);
  write(
    fixture,
    "modules/app/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(
    fixture,
    "modules/app/routes.ts",
    'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nimport Counter from "./Counter.tsx";\nexport const routes = manifest(app, { "app.home": { component: Counter } });\n',
  );
  write(
    fixture,
    "modules/app/app.contract.ts",
    'import { contract } from "@keel/router/contract";\nexport const app = contract("app", { "app.home": { path: "/" } });\n',
  );
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: fixture,
    encoding: "utf8",
    env: { ...process.env, KEEL_AGENT: "1" },
  });
  if (r.status !== 0) throw new Error(`keel build failed (status ${String(r.status)}): ${childOutput(r)}`);
  return fixture;
}

/** Environment for `node server.mjs`: the parent's without the vitest keys, plus `extra`. */
export function deployEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k.startsWith("KEEL_"))
      continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}

/** A failed child's diagnostics on one line: the non-empty lines of stdout and of stderr, each joined with ` | ` and cut to its last 440 characters, the two joined with ` | `. */
export function childOutput(r: { stdout: string; stderr: string }): string {
  const tail = (s: string): string =>
    s
      .split("\n")
      .filter((l) => l.trim() !== "")
      .join(" | ")
      .slice(-440);
  return `${tail(r.stdout)} | ${tail(r.stderr)}`;
}
