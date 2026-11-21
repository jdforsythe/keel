import fs from "node:fs";
import path from "node:path";

/** The files PGlite reads beside the module that holds it, through `new URL("./<file>", import.meta.url)`. */
const FILES = ["initdb.wasm", "pglite.data", "pglite.wasm"] as const;

/**
 * Copy PGlite's runtime files beside a server build's `server.mjs` in `out` when the bundle holds PGlite (std.postgres
 * `pglite:` mode), since the bundle reads them relative to itself. `distOf` gives the folder of the PGlite package
 * that was bundled. Returns the names copied; throws when the bundle needs the files and the package is not found.
 */
export function copyPgliteFiles(out: string, distOf: () => string | undefined): string[] {
  const server = path.join(out, "server.mjs");
  if (!fs.existsSync(server) || !fs.readFileSync(server, "utf8").includes("./pglite.wasm")) return [];
  const dist = distOf();
  if (dist === undefined)
    throw new Error("keel: server.mjs reads PGlite's files and @electric-sql/pglite is not found");
  const copied: string[] = [];
  for (const f of FILES) {
    const from = path.join(dist, f);
    if (!fs.existsSync(from)) continue;
    fs.copyFileSync(from, path.join(out, f));
    copied.push(f);
  }
  return copied;
}
