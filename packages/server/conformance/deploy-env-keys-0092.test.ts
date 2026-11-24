// Spec: k.deploy Build, "`KEEL_ORIGIN` (optional ...) ... `KEEL_PEER_<NAME>` (`my-api`: `KEEL_PEER_MY_API`), an http(s) URL, required per other `node` deployable"
// Seed 1337 (fc.assert below). Spawns the built `server.mjs` of a `keel build` fixture with two `node` deployables, `web` and `my-api`;
// a port comes from a listener on port 0 (never 8080) and the child is stopped in a `finally`.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
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

function buildTwoNodeFixture(): string {
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-deploy-env-")));
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server", "ui"]) {
    fs.mkdirSync(path.join(fixture, "node_modules", "@keel"), { recursive: true });
    fs.symlinkSync(path.join(REPO, "packages", p), path.join(fixture, "node_modules", "@keel", p));
  }
  fs.symlinkSync(path.join(REPO, "node_modules", "vite"), path.join(fixture, "node_modules", "vite"));
  fs.mkdirSync(path.join(fixture, "node_modules", ".bin"), { recursive: true });
  fs.symlinkSync("../vite/bin/vite.js", path.join(fixture, "node_modules", ".bin", "vite"));
  write(fixture, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    fixture,
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["app"], adapter: "node" }, "my-api": { modules: ["other"], adapter: "node" } });\n',
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
  for (const [id, p] of [
    ["app", "/"],
    ["other", "/other"],
  ] as const) {
    write(
      fixture,
      `modules/${id}/Page.tsx`,
      'import { Box } from "@keel/ui";\nexport default function Page() {\n  return <Box as="main">hi</Box>\n}\n',
    );
    write(
      fixture,
      `modules/${id}/module.ts`,
      `import { module } from "@keel/compiler";\nexport default module({ id: "${id}", deps: [], capabilities: [], public: { exports: [] } });\n`,
    );
    write(
      fixture,
      `modules/${id}/routes.ts`,
      `import { manifest } from "@keel/router";\nimport { ${id} } from "./${id}.contract.ts";\nimport Page from "./Page.tsx";\nexport const routes = manifest(${id}, { "${id}.home": { component: Page } });\n`,
    );
    write(
      fixture,
      `modules/${id}/${id}.contract.ts`,
      `import { contract } from "@keel/router/contract";\nexport const ${id} = contract("${id}", { "${id}.home": { path: "${p}" } });\n`,
    );
  }
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
  fixture = buildTwoNodeFixture();
}, 120_000);
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });

const SECRET = "s".repeat(32);

describe("k.deploy: DeployEnv keys", () => {
  test("`KEEL_PEER_<NAME>` is required per other `node` deployable: unset or not an http(s) URL exits 1 with one E1560 line naming `KEEL_PEER_MY_API`", () => {
    const entry = path.join(fixture, "dist", "web", "server.mjs");
    fc.assert(
      fc.property(fc.option(fc.stringMatching(/^[a-z]{1,10}$/), { nil: undefined }), (bad) => {
        const r = spawnSync(process.execPath, [entry], {
          cwd: fixture,
          encoding: "utf8",
          env: deployEnv(bad === undefined ? { KEEL_SECRET: SECRET } : { KEEL_SECRET: SECRET, KEEL_PEER_MY_API: bad }),
        });
        expect(r.status).toBe(1);
        const lines = `${r.stdout}${r.stderr}`.split("\n").filter((l) => l.includes("E1560"));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("KEEL_PEER_MY_API");
        if (bad !== undefined) expect(`${r.stdout}${r.stderr}`).not.toContain(`=${bad}`);
      }),
      { seed: 1337, numRuns: 5 },
    );
  }, 30_000);

  test("`KEEL_ORIGIN` is optional: with `KEEL_PEER_MY_API` set and `KEEL_ORIGIN` unset, `server.mjs` answers on `PORT`", async () => {
    const entry = path.join(fixture, "dist", "web", "server.mjs");
    const port = await freePort();
    const child = spawn(process.execPath, [entry], {
      cwd: fixture,
      env: deployEnv({ PORT: String(port), KEEL_SECRET: SECRET, KEEL_PEER_MY_API: "http://127.0.0.1:9" }),
      stdio: "ignore",
    });
    try {
      let status = 0;
      for (let i = 0; i < 4000 && status === 0; i++) {
        status = await fetch(`http://127.0.0.1:${port}/`).then(
          (r) => r.status,
          () => 0,
        );
      }
      expect(status).toBe(200);
    } finally {
      child.kill("SIGTERM");
    }
  }, 30_000);
});
