import { dirname } from "node:path";
import { attempt } from "@keel/schema";

/**
 * The folder of the installed `@electric-sql/pglite`, which holds its two modules, as `resolve` finds the package;
 * undefined when it finds none: a built server carries PGlite in its bundle and reads the modules `keel build` copied
 * beside `server.mjs` (k.server-deps), with no package installed beside it.
 */
export function installedPglite(resolve: (id: string) => string): string | undefined {
  const found = attempt(() => dirname(resolve("@electric-sql/pglite")));
  return found.ok ? found.value : undefined;
}
