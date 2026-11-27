// Shared fixture helpers for the k.contract Local routes conformance files that build an arbitrary project with the real `keel build` (not a test file). Seed for every property: 1337.
// Method: a temp project of the files given, the workspace packages symlinked as in local-routes-support.ts, built by `packages/cli/src/bin.ts build`; each `node` deployable is
// then started as `node dist/<name>/server.mjs` on a free port with `HOST=127.0.0.1`, and answered by a bounded retry (no timers).
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { REPO, deployEnv } from "./topology-build-fixture.ts";
import { ask } from "./local-routes-support.ts";

export type Files = Record<string, string>;
export type Built = { root: string; status: number | null; out: string };

const write = (root: string, rel: string, content: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const link = (target: string, at: string): void => {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at);
};

/** The project files every fixture holds: `package.json`, the Vite config and the tsconfig. */
export const BASE: Files = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      jsx: "react-jsx",
      jsxImportSource: "@keel/runtime-dom",
      module: "esnext",
      target: "es2022",
      moduleResolution: "bundler",
    },
  }),
};

/** `files` (over `BASE`) written to a fresh temp project with the workspace linked, then built by the real `keel build`; the caller removes `root`. */
export const buildProject = (files: Files): Built => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-local-build-")));
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server", "ui"])
    link(path.join(REPO, "packages", p), path.join(root, "node_modules", "@keel", p));
  link(path.join(REPO, "node_modules", "vite"), path.join(root, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(root, "node_modules", ".bin", "vite"));
  for (const [rel, text] of Object.entries({ ...BASE, ...files })) write(root, rel, text);
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: root,
    encoding: "utf8",
    env: deployEnv({ KEEL_AGENT: "1" }),
  });
  return { root, status: r.status, out: `${r.stdout}${r.stderr}` };
};

/** A free loopback port the OS gave. */
export const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });

export type Node = { port: number; stop: () => void; out: () => string };

/** `node dist/<name>/server.mjs` of `root` on `port` with `HOST=127.0.0.1` and `env` added; resolves once `GET <ready>` answers (bounded retry, no timers). */
export const startNode = async (
  root: string,
  name: string,
  port: number,
  env: Record<string, string>,
  ready: string,
): Promise<Node> => {
  const child: ChildProcess = spawn(process.execPath, [path.join(root, "dist", name, "server.mjs")], {
    cwd: root,
    env: deployEnv({ PORT: String(port), HOST: "127.0.0.1", KEEL_SECRET: "s".repeat(32), ...env }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout?.on("data", (c: Buffer) => {
    out += c.toString("utf8");
  });
  child.stderr?.on("data", (c: Buffer) => {
    out += c.toString("utf8");
  });
  let up = false;
  for (let i = 0; i < 4000 && !up; i++) {
    up = await ask(port, { path: ready, headers: { accept: "application/json" } }).then(
      () => true,
      () => false,
    );
  }
  if (!up) {
    child.kill("SIGKILL");
    throw new Error(`${name} did not answer: ${out.slice(-400)}`);
  }
  return { port, stop: () => child.kill("SIGTERM"), out: () => out };
};

/** The value of the API GET `id` at `urlPath` of the server on `port`, read over a loopback connection that satisfies `local`. */
export const value = async (port: number, urlPath: string, id: string): Promise<unknown> => {
  const r = await ask(port, {
    path: urlPath,
    headers: { host: `127.0.0.1:${port}`, accept: "application/json", "sec-fetch-site": "none" },
  });
  const doc: unknown = JSON.parse(r.body);
  const results: unknown = typeof doc === "object" && doc !== null ? Reflect.get(doc, "results") : undefined;
  const one: unknown = typeof results === "object" && results !== null ? Reflect.get(results, id) : undefined;
  return typeof one === "object" && one !== null ? Reflect.get(one, "value") : undefined;
};

export const REMOVE = (root: string): void => fs.rmSync(root, { recursive: true, force: true });
