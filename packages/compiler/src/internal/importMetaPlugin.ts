import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "esbuild";
import { withImportMeta } from "./withImportMeta.ts";

/** A module the bundle loads from a file. */
const CODE = /\.[cm]?[jt]sx?$/;
const LOADER: Readonly<Record<string, "ts" | "tsx" | "jsx">> = {
  ts: "ts",
  mts: "ts",
  cts: "ts",
  tsx: "tsx",
  jsx: "jsx",
};

/** Each file's last code and what `withImportMeta` made of it, for the bundles of one process. */
const seen = new Map<string, { readonly code: string; readonly own: string }>();

/**
 * The last esbuild plugin of a build-time evaluation bundle: a module no earlier plugin loaded that uses
 * `import.meta` gets its own (`withImportMeta`); any other is loaded by esbuild as it is.
 */
export function importMetaPlugin(): Plugin {
  return {
    name: "keel-import-meta",
    setup(b) {
      b.onLoad({ filter: CODE }, (args) => {
        const code = fs.readFileSync(args.path, "utf8");
        const last = seen.get(args.path);
        const own = last !== undefined && last.code === code ? last.own : withImportMeta(code, args.path);
        seen.set(args.path, { code, own });
        if (own === code) return undefined;
        const ext = args.path.slice(args.path.lastIndexOf(".") + 1);
        return { contents: own, loader: LOADER[ext] ?? "js", resolveDir: path.dirname(args.path) };
      });
    },
  };
}
