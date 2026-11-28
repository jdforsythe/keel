import { dirname } from "node:path";
import { attempt } from "@keel/schema";

/** `resolve` found no package: Node's `MODULE_NOT_FOUND`. */
const NOT_INSTALLED = Object.freeze({
  code: "postgres.notInstalled",
  message: "No PGlite package is installed",
  data: null,
});

/**
 * The folder of the installed `@electric-sql/pglite`, which holds its two modules, as `resolve` finds the package;
 * undefined when it finds none: a built server carries PGlite in its bundle and reads the modules `keel build` copied
 * beside `server.mjs` (k.server-deps), with no package installed beside it.
 */
export function installedPglite(resolve: (id: string) => string): string | undefined {
  const found = attempt(
    () => dirname(resolve("@electric-sql/pglite")),
    (x) => (x instanceof Error && Reflect.get(x, "code") === "MODULE_NOT_FOUND" ? NOT_INSTALLED : undefined),
  );
  return found.ok ? found.value : undefined;
}
