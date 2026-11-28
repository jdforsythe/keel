import fs from "node:fs";
import type { Plugin } from "esbuild";
import { censusSource } from "./censusSource.ts";

/**
 * An esbuild plugin for a bundle that inlines kernel packages and runs in this process (`evaluateProject`,
 * `projectTokens`): each census module names its own file (`censusSource`), so the inlined copy is that file
 * evaluated again, never a second copy (k.realm One copy).
 */
export function censusPlugin(): Plugin {
  return {
    name: "keel-census",
    setup(b) {
      b.onLoad({ filter: /[\\/]internal[\\/](?:records|codedError)\.(?:ts|js)$/ }, (args) => {
        const contents = censusSource(args.path, fs.readFileSync(args.path, "utf8"));
        return contents === undefined ? undefined : { contents, loader: args.path.endsWith(".ts") ? "ts" : "js" };
      });
    },
  };
}
