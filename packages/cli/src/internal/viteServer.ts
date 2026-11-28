import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { DevServer } from "./DevServer.ts";
import { devPoll } from "./devPoll.ts";
import { isRecord } from "./isRecord.ts";

const field = (v: unknown, key: string): unknown => (isRecord(v) ? v[key] : undefined);
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Replaces the `info`, `warn`, `warnOnce` and `error` of Vite's `logger` with ones that write `msg` with no ANSI. */
const plainLogger = (logger: unknown): void => {
  if (!isRecord(logger)) return;
  for (const name of ["info", "warn", "warnOnce", "error"]) {
    const write = logger[name];
    if (typeof write !== "function") continue;
    Reflect.set(logger, name, (msg: unknown, ...rest: unknown[]): unknown =>
      write.call(logger, typeof msg === "string" ? msg.replace(ANSI, "") : msg, ...rest),
    );
  }
};

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
 * `server.host` only when `host` (`keel dev --host`) is given, and
 * `server.watch` `{ usePolling: true, interval: 100 }` when `KEEL_DEV_POLL` is `1` (merged over the project's own
 * `server.watch`; unset, empty or `0` passes none). Any other value throws. This
 * evaluates the project's `vite.config.ts` and its plugins' `config` hooks once; nothing listens yet. What
 * `createServer` returns is checked at runtime against the shape `keel dev` uses. With `plain`, its logger writes no ANSI
 * (docs/OUTPUT.md: compact and json carry no color, whatever `CI` makes Vite's colors think). Throws when `vite` cannot
 * be resolved or does not fit.
 */
export async function viteServer(
  cwd: string,
  port: number | undefined,
  host: string | undefined = undefined,
  plain = false,
): Promise<DevServer> {
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
      ...(host === undefined ? {} : { host }),
      ...(poll === "on" ? { watch: { usePolling: true, interval: 100 } } : {}),
    },
  });
  const config = field(server, "config");
  if (plain) plainLogger(field(config, "logger"));
  const info = method(field(config, "logger"), "info");
  const listen = method(server, "listen");
  const closeVite = method(server, "close");
  const http = field(server, "httpServer");
  const twins: ReturnType<typeof createServer>[] = [];
  const close = async (): Promise<unknown> => {
    for (const t of twins.splice(0)) await new Promise<void>((done) => t.close(() => done()));
    return closeVite();
  };
  const printUrls = method(server, "printUrls");
  const shortcuts =
    typeof field(server, "bindCLIShortcuts") === "function" ? method(server, "bindCLIShortcuts") : undefined;
  return {
    version: typeof version === "string" ? version : "",
    port: field(field(config, "server"), "port"),
    host: field(field(config, "server"), "host"),
    listen: () => Promise.resolve(listen()),
    loopback: (at) =>
      new Promise((resolve, reject) => {
        const twin = createServer();
        for (const event of ["request", "upgrade"]) {
          const ls = typeof field(http, "listeners") === "function" ? method(http, "listeners")(event) : [];
          if (Array.isArray(ls))
            for (const l of ls)
              if (typeof l === "function")
                twin.on(event, (...args: unknown[]) => {
                  Reflect.apply(l, http, args);
                });
        }
        twin.once("error", reject);
        twin.listen(at, "127.0.0.1", () => {
          twins.push(twin);
          resolve();
        });
      }),
    close,
    printUrls: () => {
      printUrls();
    },
    info: (message) => {
      info(message);
    },
    shortcuts: () => {
      shortcuts?.({ print: true });
    },
  };
}
