// Shared helpers for the `static` deployable conformance files (not a test file): the real `keel` binary over a temp project with `@keel/*` linked
// (compat-support.ts). Seed 1337 for every property.
// ASSUMPTIONS (spec names no fixture layout): module `s` serves routes `/` and `/about` whose loaders (in `s.server.ts`) return `{ text }`
// and whose page shows `props.data.text`; a deployable `site` has adapter `static`; a failing loader returns `err` of a `keel.notFound` error.
import { type ChildProcess, spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Tree } from "./compat-support.ts";

export const SEED = 1337;
export const SLOW = 300_000;
export const HOME_TEXT = "HOME-TEXT-1337";
export const ABOUT_TEXT = "ABOUT-TEXT-1337";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

export type Failing = "none" | "notFound" | "denied" | "throws";

const loaderSrc = (id: string, text: string, failing: boolean, how: Failing): string => {
  const body =
    failing && how === "notFound"
      ? "return err(Missing.make({}))"
      : failing && how === "throws"
        ? "throw new Error('boom')"
        : `return ok({ text: '${text}' })`;
  return `export const ${id.replace(".", "_")} = loader(site, '${id}', { output: Out }, async () => {\n  ${body}\n})\n`;
};

/** A project whose deployable `site` has adapter `static` (or `adapter`) over module `s`; `failing` breaks the loader of `/about`. */
export function staticTree(failing: Failing = "none", topologyBody?: string, adapter = "static"): Tree {
  return {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
    "topology.ts":
      topologyBody ??
      `import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: '${adapter}' } })\n`,
    "modules/s/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 's', deps: [], capabilities: [], public: { exports: [] } })\n",
    "modules/s/s.contract.ts":
      "import { contract } from '@keel/router/contract'\nexport const site = contract('s', { 's.home': { path: '/' }, 's.about': { path: '/about' } })\n",
    "modules/s/s.server.ts":
      "import { guard, loader } from '@keel/router'\nimport { err, ok, s } from '@keel/schema'\nimport { site } from './s.contract.ts'\n" +
      "const Out = s.object({ text: s.string() })\nconst Missing = s.error('keel.notFound', s.object({}))\n" +
      loaderSrc("s.home", HOME_TEXT, false, failing) +
      loaderSrc("s.about", ABOUT_TEXT, failing === "notFound" || failing === "throws", failing) +
      "const Denied = s.error('keel.denied', s.object({}))\nexport const deny = guard({}, async () => err(Denied.make({})))\n",
    "modules/s/routes.ts":
      "import { manifest } from '@keel/router'\nimport { Text } from '@keel/ui'\nimport { site } from './s.contract.ts'\nimport { deny, s_home, s_about } from './s.server.ts'\n" +
      "const Home = (props: { data: { text: string } }) => Text({ id: 's.home.text', children: props.data.text })\n" +
      "const About = (props: { data: { text: string } }) => Text({ id: 's.about.text', children: props.data.text })\n" +
      `export const routes = manifest(site, { 's.home': { component: Home, loader: s_home }, 's.about': { component: About, loader: s_about${failing === "denied" ? ", guard: deny" : ""} } })\n`,
  };
}

/** The streamed json records of a run of `keel <args>` are read by compat-support's `keel`; this is the env-clean spawn for `keel dev`. */
export type Proc = { child: ChildProcess; out: () => string; exited: Promise<number | null> };
const started = new Set<Proc>();
const childEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k === "PORT") continue;
    env[k] = v;
  }
  return env;
};
export function startDev(cwd: string, port: number): Proc {
  const child = spawn(process.execPath, [BIN, "dev", "--port", String(port), "--format=json"], {
    cwd,
    env: childEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let buf = "";
  child.stdout?.on("data", (d: Buffer) => {
    buf += d.toString();
  });
  child.stderr?.on("data", (d: Buffer) => {
    buf += d.toString();
  });
  const exited = new Promise<number | null>((res) => child.on("close", (code) => res(code)));
  const p: Proc = { child, out: () => buf, exited };
  started.add(p);
  return p;
}
function signal(p: Proc, s: NodeJS.Signals): void {
  const pid = p.child.pid;
  if (pid === undefined || p.child.exitCode !== null || p.child.signalCode !== null) return;
  try {
    process.kill(-pid, s);
  } catch {
    // the group is gone
  }
}
/** SIGTERM to the child's group, SIGKILL if it has not closed 10 s later. */
export async function stop(p: Proc): Promise<void> {
  started.delete(p);
  signal(p, "SIGTERM");
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<"late">((r) => {
    timer = setTimeout(() => r("late"), 10_000);
  });
  const first = await Promise.race([p.exited, late]);
  clearTimeout(timer);
  if (first === "late") signal(p, "SIGKILL");
  await p.exited;
}
export const stopAll = (): Promise<void[]> => Promise.all([...started].map(stop));
process.once("exit", () => {
  for (const p of started) signal(p, "SIGKILL");
});
export const freePort = (): Promise<number> =>
  new Promise((res, rej) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const a = srv.address();
      srv.close(() => (typeof a === "object" && a !== null ? res(a.port) : rej(new Error("no port"))));
    });
  });
export type Reply = { readonly status: number; readonly body: string };
export const get = (port: number, path: string): Promise<Reply | null> =>
  new Promise((done) => {
    const req = http.get(
      { host: "localhost", port, path, headers: { accept: "text/html" }, agent: false, timeout: 10_000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => done({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", () => done(null));
        res.on("aborted", () => done(null));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => done(null));
  });
/** Retries `GET /` (fixed 50 ms pause, at most 800 tries) until it answers, or the process exits; the answer or null. */
export async function served(p: Proc, port: number): Promise<boolean> {
  let done = false;
  void p.exited.then(() => {
    done = true;
  });
  for (let i = 0; i < 800 && !done; i++) {
    if (i > 0) await pause(50);
    if ((await get(port, "/")) !== null) return true;
  }
  return false;
}

const SERVER_SECRET = "s".repeat(32);
/** Runs `node dist/<name>/server.mjs` (k.hosting) on a free port with `PORT` and `KEEL_SECRET`, polls `GET /` (bounded), calls `fn(port)`, then kills the group. */
export async function withServer(dir: string, name: string, fn: (port: number) => Promise<void>): Promise<void> {
  const port = await freePort();
  const env = childEnv();
  env.PORT = String(port);
  env.KEEL_SECRET = SERVER_SECRET;
  const child = spawn(process.execPath, [join(dir, "dist", name, "server.mjs")], {
    cwd: dir,
    env,
    stdio: "ignore",
    detached: true,
  });
  const p: Proc = { child, out: () => "", exited: new Promise((res) => child.on("close", (c) => res(c))) };
  started.add(p);
  try {
    if (!(await served(p, port))) throw new Error("server.mjs did not answer");
    await fn(port);
  } finally {
    await stop(p);
  }
}

/** The `href` of each `<link rel="stylesheet">` in `html`. */
export const stylesheetsOf = (html: string): string[] =>
  [...html.matchAll(/<link\b[^>]*>/g)].flatMap((m) => {
    const tag = m[0];
    if (!/rel="stylesheet"/.test(tag)) return [];
    const href = /href="([^"]+)"/.exec(tag)?.[1];
    return href === undefined ? [] : [href];
  });
