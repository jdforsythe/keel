import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { field } from "./field.ts";

/** The configs a project's tests run under, in the order Vitest picks them. */
const CONFIGS = [
  "vitest.config.ts",
  "vitest.config.mts",
  "vitest.config.js",
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.js",
];

/** The nearest config at or above `dir`, if any. */
function configAbove(dir: string): string | undefined {
  for (let at = dir; ; at = dirname(at)) {
    const name = CONFIGS.find((n) => existsSync(join(at, n)));
    if (name !== undefined) return join(at, name);
    if (dirname(at) === at) return undefined;
  }
}

/** The host worker entry beside this file (source `.ts`, or a build's `.js`), run with tsx as the user workers are. */
const here = import.meta.url;
const entry = (): URL => new URL(`./projectHost.${here.endsWith(".ts") ? "ts" : "js"}`, here);
const loader = (): string => pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;

type Project = { invoke(data: unknown): Promise<{ result: unknown } | { error: unknown }> };
type Answer = (answer: { result: unknown } | { error: unknown }) => void;

/** One host per project config (or per directory of a user module with none) while it lives. */
const hosts = new Map<string, Promise<Project>>();

/**
 * Start a host worker (projectHost.ts) for `config` at `root`, kept under `key` until it ends; resolves once its
 * dev server is up. A host that ends answers every waiting request with an error. Shared by every group of the
 * process, the host keeps the process alive only while it starts or a request waits on it.
 */
function host(key: string, root: string, config: string | undefined): Promise<Project> {
  const worker = new Worker(entry(), { execArgv: ["--import", loader()], workerData: { root, config } });
  const waiting = new Map<number, Answer>();
  let next = 0;
  return new Promise((resolve, reject) => {
    const fail = (error: Error): void => {
      hosts.delete(key);
      reject(error);
      for (const answer of waiting.values()) answer({ error: { name: "Error", message: error.message } });
      waiting.clear();
    };
    worker.on("error", fail);
    worker.on("exit", (code) => fail(new Error(`group: project host exited ${code}`)));
    worker.on("message", (m: unknown) => {
      if (field(m, "ready") === true) {
        worker.unref();
        resolve({
          invoke: (data) =>
            new Promise((answer) => {
              const id = next++;
              if (waiting.size === 0) worker.ref();
              waiting.set(id, answer);
              worker.postMessage({ id, data });
            }),
        });
        return;
      }
      const id = field(m, "id");
      const answer = typeof id === "number" ? waiting.get(id) : undefined;
      if (answer === undefined || typeof id !== "number") return;
      waiting.delete(id);
      if (waiting.size === 0) worker.unref();
      const error = field(m, "error");
      answer(error === undefined ? { result: field(m, "result") } : { error });
    });
  });
}

/**
 * The module transport of the project of group user module `user` (std.multi `user`, a `file:` URL): `invoke`
 * answers a user worker's module runner (`vite:invoke`, as `projectLoader` sends it) from one SSR dev server through
 * the nearest Vite config above `user` (an app's carries the Keel compiler's plugin, which compiles its modules:
 * scopes around module-level stores, JSX, ids), with workspace packages inlined; with no config above `user`, Vite's
 * own TypeScript transform. The server runs in a host worker thread of its own (projectHost.ts), and every group of
 * this process with that project shares it, so each module is transformed once and each user worker only evaluates
 * it. An error comes back as its `name`, `message` and `stack`.
 */
export function projectServer(user: string): Promise<Project> {
  const file = fileURLToPath(user);
  const config = configAbove(dirname(file));
  const key = config ?? dirname(file);
  let started = hosts.get(key);
  if (started === undefined) {
    started = host(key, dirname(config ?? file), config);
    hosts.set(key, started);
  }
  return started;
}
