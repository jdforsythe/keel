import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ViteDevServer, createServer } from "vite";

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

/** One dev server per project config (or per directory of a user module with none), for the life of this module. */
const servers = new Map<string, Promise<ViteDevServer>>();

/**
 * The module transport of the project of group user module `user` (std.multi `user`, a `file:` URL): `invoke`
 * answers a user worker's module runner (`vite:invoke`, as `projectLoader` sends it) from one SSR dev server through
 * the nearest Vite config above `user` (an app's carries the Keel compiler's plugin, which compiles its modules:
 * scopes around module-level stores, JSX, ids), with workspace packages inlined; with no config above `user`, Vite's
 * own TypeScript transform. Every group of this process with that project shares the server, so each module is
 * transformed once and each worker only evaluates it. An error comes back as its `name`, `message` and `stack`.
 */
export async function projectServer(
  user: string,
): Promise<{ invoke(data: unknown): Promise<{ result: unknown } | { error: unknown }> }> {
  const file = fileURLToPath(user);
  const config = configAbove(dirname(file));
  const key = config ?? dirname(file);
  let started = servers.get(key);
  if (started === undefined) {
    started = createServer({
      root: dirname(config ?? file),
      configFile: config ?? false,
      logLevel: "silent",
      appType: "custom",
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    servers.set(key, started);
    started.catch(() => servers.delete(key));
  }
  const ssr = (await started).environments.ssr;
  return {
    invoke: async (data) => {
      const r = await ssr.hot.handleInvoke({ type: "custom", event: "vite:invoke", data });
      if (!("error" in r)) return { result: r.result };
      const e: unknown = r.error;
      const text = (k: string): string | undefined => {
        const v: unknown = typeof e === "object" && e !== null ? Reflect.get(e, k) : undefined;
        return typeof v === "string" ? v : undefined;
      };
      return { error: { name: text("name") ?? "Error", message: text("message") ?? String(e), stack: text("stack") } };
    },
  };
}
