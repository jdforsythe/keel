// The shell smokes' way into an app's sources: a module of `appDir` loaded as the app's own tests load it, through an
// SSR dev server over the app's Vite config (its Vitest config first, as Vitest picks it), whose Keel plugin compiles
// each app module (k.reactive Module roots: a maker at a module's top level runs in a module root). A plain `node`
// or tsx import of an app module compiles nothing, so a `store` or `chart` at its top level has no owner (E1203).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** The configs an app's tests run under, in the order Vitest picks them. */
const CONFIGS = ["vitest.config.ts", "vitest.config.mts", "vitest.config.js", "vite.config.ts", "vite.config.mts"];

/**
 * Load `file` (a path relative to `appDir`, or absolute) through the app's compiler; resolves to `{ module, close }`,
 * the module's exports and a `close()` that stops the dev server. Vite is the app's own.
 */
export async function compiledImport(appDir, file) {
  const config = CONFIGS.map((n) => path.join(appDir, n)).find((f) => fs.existsSync(f));
  const vite = await import(pathToFileURL(createRequire(path.join(appDir, "package.json")).resolve("vite")).href);
  const server = await vite.createServer({
    root: appDir,
    configFile: config ?? false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
    const module = await runner.import(path.resolve(appDir, file));
    return {
      module,
      close: async () => {
        await runner.close();
        await server.close();
      },
    };
  } catch (e) {
    await server.close();
    throw e;
  }
}
