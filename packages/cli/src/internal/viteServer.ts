import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { DevServer } from "./DevServer.ts";
import { devPoll } from "./devPoll.ts";
import { isRecord } from "./isRecord.ts";

const field = (v: unknown, key: string): unknown => (isRecord(v) ? v[key] : undefined);

/** `name` of `owner` as a function called on `owner`; throws when the project's Vite lacks it. */
const method = (owner: unknown, name: string): ((...args: unknown[]) => unknown) => {
  const f = field(owner, name);
  if (typeof f !== "function") throw new Error(`vite dev server has no ${name}()`);
  return (...args: unknown[]): unknown => f.apply(owner, args);
};

/**
 * The entry of the `vite` installed for `dir`: the nearest `node_modules/vite` at or above it, resolved through its
 * `package.json`. Only the project's own tree counts (never `NODE_PATH` or a global install), so a project without
 * Vite fails here instead of running another copy.
 */
const projectVite = (dir: string): string => {
  for (let at = dir; ; at = dirname(at)) {
    if (existsSync(join(at, "node_modules", "vite", "package.json")))
      return createRequire(join(at, "package.json")).resolve("vite");
    if (dirname(at) === at) throw new Error(`vite is not installed in ${dir}`);
  }
};

/** Whether `CHOKIDAR_USEPOLLING` asks for a polling file watcher: set, and not empty, `0` or `false`. */
const polls = (): boolean => !["", "0", "false"].includes((process.env.CHOKIDAR_USEPOLLING ?? "").toLowerCase());

/**
 * Binary only: the project's own `vite` (the nearest `node_modules/vite` at or above `cwd`, as `npx --no-install vite`
 * finds it) creates a dev server for `cwd` with `server.strictPort`, `server.port` only when `port` is given, and
 * `server.watch` `{ usePolling: true, interval: 100 }` when `KEEL_DEV_POLL` is `1` (merged over the project's own
 * `server.watch`; unset, empty or `0` passes none). Any other value throws. This
 * evaluates the project's `vite.config.ts` and its plugins' `config` hooks once; nothing listens yet. What
 * `createServer` returns is checked at runtime against the shape `keel dev` uses. Throws when `vite` cannot be
 * resolved or does not fit.
 */
export async function viteServer(cwd: string, port: number | undefined): Promise<DevServer> {
  const mod: unknown = await import(pathToFileURL(projectVite(cwd)).href);
  const create = method(mod, "createServer");
  const version = field(mod, "version");
  const poll = devPoll(process.env.KEEL_DEV_POLL);
  if (poll === undefined) throw new Error("KEEL_DEV_POLL must be 1, 0 or unset");
  const server: unknown = await create({
    root: cwd,
    server: {
      strictPort: true,
      ...(port === undefined ? {} : { port }),
      ...(poll === "on" ? { watch: { usePolling: true, interval: 100 } } : {}),
    },
  });
  const config = field(server, "config");
  const info = method(field(config, "logger"), "info");
  const listen = method(server, "listen");
  const close = method(server, "close");
  const printUrls = method(server, "printUrls");
  const shortcuts =
    typeof field(server, "bindCLIShortcuts") === "function" ? method(server, "bindCLIShortcuts") : undefined;
  // Vite's file watcher; a server without one (`server.watch: null`) sees no change, so nothing refreshes.
  const watcher = field(server, "watcher");
  const on = typeof field(watcher, "on") === "function" ? method(watcher, "on") : undefined;
  const add = typeof field(watcher, "add") === "function" ? method(watcher, "add") : undefined;
  return {
    version: typeof version === "string" ? version : "",
    port: field(field(config, "server"), "port"),
    listen: () => Promise.resolve(listen()),
    close: () => Promise.resolve(close()),
    printUrls: () => {
      printUrls();
    },
    info: (message) => {
      info(message);
    },
    shortcuts: () => {
      shortcuts?.({ print: true });
    },
    onChange: (listener) => {
      on?.("all", (event: unknown, file: unknown) => {
        if (typeof event === "string" && typeof file === "string") listener(event, file);
      });
    },
    watch: (files) => {
      if (files.length > 0) add?.([...files]);
    },
  };
}
