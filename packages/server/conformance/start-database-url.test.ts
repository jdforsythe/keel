// Spec: k.deploy, clause "With `storage: 'postgres'`, `server.mjs` with `KEEL_DATABASE_URL` unset, or set to a `file:` URL, exits 1 with one E1560 naming `KEEL_DATABASE_URL` and no value."
// Seed: 1337.
// ASSUMPTION: the fixture lists `@keel/std-db` in `dependencies` (E1572) and `keel build` needs no database; startup fails in `DeployEnv` before storage opens.
import { testTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { REPO, deployEnv } from "./topology-build-fixture.ts";

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function buildPostgresFixture(): string {
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-database-url-")));
  fs.mkdirSync(path.join(fixture, "node_modules", "@keel"), { recursive: true });
  for (const p of [
    "compiler",
    "ctx",
    "reactive",
    "router",
    "runtime-dom",
    "schema",
    "store",
    "server",
    "std-db",
    "ui",
  ]) {
    fs.symlinkSync(path.join(REPO, "packages", p), path.join(fixture, "node_modules", "@keel", p));
  }
  fs.symlinkSync(path.join(REPO, "node_modules", "vite"), path.join(fixture, "node_modules", "vite"));
  fs.mkdirSync(path.join(fixture, "node_modules", ".bin"), { recursive: true });
  fs.symlinkSync("../vite/bin/vite.js", path.join(fixture, "node_modules", ".bin", "vite"));
  write(
    fixture,
    "package.json",
    `${JSON.stringify({ name: "fx", private: true, type: "module", dependencies: { "@keel/std-db": "workspace:*" } })}\n`,
  );
  write(
    fixture,
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["app"], adapter: "node", storage: "postgres" } });\n',
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
  write(
    fixture,
    "modules/app/Page.tsx",
    'import { Box } from "@keel/ui";\nexport default function Page() {\n  return <Box as="main">hi</Box>\n}\n',
  );
  write(
    fixture,
    "modules/app/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(
    fixture,
    "modules/app/routes.ts",
    'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nimport Page from "./Page.tsx";\nexport const routes = manifest(app, { "app.home": { component: Page } });\n',
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
  if (r.status !== 0) throw new Error(`keel build failed (status ${String(r.status)})\n${r.stdout}\n${r.stderr}`);
  return fixture;
}

let fixture = "";
beforeAll(() => {
  fixture = buildPostgresFixture();
}, 120_000);
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));

const SECRET = "s".repeat(32);

describe("k.deploy: KEEL_DATABASE_URL of a 'postgres' deployable", () => {
  test("With `storage: 'postgres'`, `server.mjs` with `KEEL_DATABASE_URL` unset, or set to a `file:` URL, exits 1 with one E1560 naming `KEEL_DATABASE_URL` and no value.", () => {
    const entry = path.join(fixture, "dist", "web", "server.mjs");
    const fileUrl = fc.stringMatching(/^[a-z]{3,12}$/).map((name) => `file:/data/${name}-zqmarker.sqlite`);
    fc.assert(
      fc.property(fc.option(fileUrl, { nil: undefined }), (url) => {
        const env = url === undefined ? { KEEL_SECRET: SECRET } : { KEEL_SECRET: SECRET, KEEL_DATABASE_URL: url };
        // A child process that exits; spawnSync bounds it, nothing is left running.
        const r = spawnSync(process.execPath, [entry], {
          cwd: fixture,
          encoding: "utf8",
          env: deployEnv(env),
          timeout: testTime(30_000),
        });
        expect(r.status).toBe(1);
        const out = `${r.stdout}${r.stderr}`;
        const lines = out.split("\n").filter((l) => l.includes("E1560"));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("KEEL_DATABASE_URL");
        if (url !== undefined) expect(out).not.toContain("zqmarker");
      }),
      { seed: 1337, numRuns: 5 },
    );
  }, 30_000);
});
