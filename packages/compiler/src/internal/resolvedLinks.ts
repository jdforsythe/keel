import fs from "node:fs";
import path from "node:path";
import type { Metafile } from "esbuild";
import { isNodeBuiltin } from "./isNodeBuiltin.ts";

/** The package a bare specifier names: `@scope/name` or `name`; undefined for a relative, absolute or URL one. */
function packageName(spec: string): string | undefined {
  if (spec.startsWith(".") || spec.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(spec)) return undefined;
  const parts = spec.split("/");
  return spec.startsWith("@") ? (parts.length > 1 ? `${parts[0]}/${parts[1]}` : undefined) : parts[0];
}

/**
 * The `node_modules/<name>` entries the bare imports of a bundle resolved through (k.derived Derivation cache), absolute
 * and sorted: for each import in `metafile` of a package (no Node built-in, nothing external), the first
 * `<folder>/node_modules/<name>` that exists walking up from the importing file's folder, as Node's resolution finds
 * it. Each is a path through the project whose real path tells which copy of the package was loaded.
 */
export function resolvedLinks(root: string, metafile: Metafile): string[] {
  const out = new Set<string>();
  const seen = new Set<string>();
  for (const [importer, input] of Object.entries(metafile.inputs)) {
    if (/^[a-z-]+:/.test(importer) || importer.includes("<")) continue;
    const from = path.dirname(path.resolve(root, importer));
    for (const i of input.imports) {
      const name = i.original === undefined || i.external === true ? undefined : packageName(i.original);
      if (name === undefined || isNodeBuiltin(name) || seen.has(`${from}\0${name}`)) continue;
      seen.add(`${from}\0${name}`);
      for (let d = from; ; d = path.dirname(d)) {
        const at = path.join(d, "node_modules", name);
        let found = false;
        try {
          fs.lstatSync(at);
          found = true;
        } catch {
          found = false;
        }
        if (found) {
          out.add(at);
          break;
        }
        if (path.dirname(d) === d) break;
      }
    }
  }
  return [...out].sort();
}
