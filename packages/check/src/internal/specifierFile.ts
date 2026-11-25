import path from "node:path";
import ts from "typescript";

/**
 * `specifier` with `.` and `..` segments of its subpath folded (`p/lib/../lib/x.ts` is `p/lib/x.ts`), so a spelling
 * `exports` refuses but a bundler may take is still followed; unchanged when the subpath climbs above the package.
 */
function tidied(specifier: string): string {
  const parts = specifier.split("/");
  const name = parts.slice(0, specifier.startsWith("@") ? 2 : 1);
  const sub = path.posix.normalize(parts.slice(name.length).join("/"));
  return sub === "." || sub.startsWith("../") || sub === ".." ? specifier : [...name, sub].join("/");
}

/**
 * The file a non-relative `specifier` (no query) in the file at absolute path `at` resolves to as the type check
 * resolves it (k.bundle Aliases), tried as written, then with its subpath's `.` and `..` segments folded; undefined
 * when neither resolves.
 */
export function specifierFile(
  specifier: string,
  at: string,
  options: ts.CompilerOptions,
  cache: ts.ModuleResolutionCache,
): string | undefined {
  const hit =
    ts.resolveModuleName(specifier, at, options, ts.sys, cache).resolvedModule ??
    ts.resolveModuleName(tidied(specifier), at, options, ts.sys, cache).resolvedModule;
  return hit?.resolvedFileName;
}
