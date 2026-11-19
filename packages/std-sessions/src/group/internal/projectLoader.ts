import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

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

/**
 * A loader for the project of group user module `user` (std.multi `user`, a `file:` URL), loading modules the way
 * the project's tests do: through the nearest Vite config above `user` (an app's carries the Keel compiler's plugin,
 * which compiles its modules: scopes around module-level stores, JSX, ids), with workspace packages inlined, so
 * everything a worker loads through it shares one copy of each kernel module. With no config above `user`, Vite's
 * own TypeScript transform. The loader takes a `file:` URL.
 */
export async function projectLoader(user: string): Promise<(url: string) => Promise<unknown>> {
  const file = fileURLToPath(user);
  const config = configAbove(dirname(file));
  const server = await createServer({
    root: dirname(config ?? file),
    configFile: config ?? false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  return (url) => server.ssrLoadModule(fileURLToPath(url));
}
