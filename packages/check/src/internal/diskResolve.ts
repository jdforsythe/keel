import fs from "node:fs";
import path from "node:path";
import type { Resolve } from "@keel/compiler/internal";
import ts from "typescript";
import { specifierFile } from "./specifierFile.ts";
import { tsCompilerOptions } from "./tsCompilerOptions.ts";

/**
 * A `Resolve` for the project at absolute folder `base` whose files are `known` (paths relative to `base`), as
 * k.boundary Following and k.bundle Aliases say: a relative specifier joined to the importer's folder, with each
 * extension or `/index` file tried; any other but a `#` or root-absolute one resolved as the type check resolves it
 * (bundler resolution, `exports`, `node_modules` upward, symlinks followed to the real path, no `tsconfig.json`),
 * its subpath's `.` and `..` segments folded when it does not resolve as written, and kept when that real path is a
 * project file outside `node_modules/`.
 */
export function diskResolve(base: string, known: ReadonlySet<string>, relative: Resolve): Resolve {
  const options = tsCompilerOptions();
  const cache = ts.createModuleResolutionCache(base, (s) => s, options);
  let real: string | undefined;
  const realBase = (): string | undefined => {
    if (real === undefined && fs.existsSync(base)) real = fs.realpathSync(base);
    return real;
  };
  return (from, specifier) => {
    if (specifier.startsWith("./") || specifier.startsWith("../")) return relative(from, specifier);
    if (specifier === "" || specifier.startsWith("#") || specifier.startsWith("/") || specifier.startsWith("."))
      return undefined;
    const root = realBase();
    if (root === undefined) return undefined;
    const at = path.join(base, from);
    const hit = specifierFile(specifier, at, options, cache);
    if (hit === undefined) return undefined;
    let landed: string;
    try {
      landed = path.relative(root, fs.realpathSync(hit)).split(path.sep).join("/");
    } catch {
      return undefined;
    }
    if (landed.startsWith("../") || path.isAbsolute(landed) || /(?:^|\/)node_modules\//.test(landed)) return undefined;
    return known.has(landed) ? landed : undefined;
  };
}
