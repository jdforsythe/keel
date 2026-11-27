import fs from "node:fs";
import nodeModule from "node:module";
import type { Plugin } from "esbuild";
import { REFUSED_BUILTINS } from "./REFUSED_BUILTINS.ts";

const NS = "keel-observe";
/** The Node modules whose imports in a build-time evaluation bundle go through the bundle's own view. */
const OBSERVED = /^(?:node:)?(?:fs|fs\/promises|process|module)$/;
const IDENT = /^[A-Za-z_$][\w$]*$/;
const escaped = REFUSED_BUILTINS.map((m) => m.replace("/", "\\/")).join("|");
/** The built-ins whose imports get a view that refuses each call (`REFUSED_BUILTINS`). */
const REFUSED = new RegExp(`^(?:node:)?(?:${escaped})$`);
/** A native addon, whose import fails the bundle (E1050). */
const ADDON = /\.node$/;
const nodeRequire = nodeModule.createRequire(import.meta.url);
/** The names a module exports, for its view's named exports. */
const namesOf = (name: string): readonly string[] => {
  const m: unknown = nodeRequire(name);
  return typeof m === "object" && m !== null ? Object.keys(m) : [];
};

/** The view each observed module's imports get, a binding of `OBSERVE_BANNER`, and the names it exports. */
const VIEWS: Readonly<Record<string, readonly [string, readonly string[]]>> = {
  fs: ["__keelFs.fs", Object.keys(fs)],
  "fs/promises": ["__keelFs.promises", Object.keys(fs.promises)],
  process: ["__keelProcess", Object.keys(process)],
  module: ["__keelModule", Object.keys(nodeModule)],
};

/** The source of the view module of `name`: `export const <k> = view.<k>;` for each name, and the view as the default. */
function viewSource(name: string): string {
  const [view, names] = VIEWS[name] ?? [`__keelRefusedView(${JSON.stringify(name)})`, namesOf(name)];
  return [
    `const keelView = ${view};`,
    ...names.filter((k) => IDENT.test(k) && k !== "default").map((k) => `export const ${k} = keelView.${k};`),
    "export default keelView;",
  ].join("\n");
}

/**
 * The esbuild plugin of a build-time evaluation bundle that observes its reads (k.derived Derivation cache): each
 * import of `node:fs`, `node:fs/promises`, `node:process` or `node:module` (with or without `node:`), static, a literal
 * `require` or a literal `import()`, gets a module of the bundle's own that re-exports its view (`OBSERVE_BANNER`).
 * An import of a built-in of `REFUSED_BUILTINS` gets the view whose every call is refused; an import of a `.node`
 * addon fails the bundle at that import; both with E1050 (k.compiler Build-time evaluation).
 */
export function observePlugin(): Plugin {
  return {
    name: "keel-observe",
    setup(b) {
      b.onResolve({ filter: ADDON }, (args) => ({
        errors: [
          {
            text: `E1050 the native addon ${args.path} at build time: Keel cannot see what it reads, so a build-time evaluation does not run it`,
          },
        ],
      }));
      const view = (args: { path: string }) => ({ path: args.path.replace(/^node:/, ""), namespace: NS });
      b.onResolve({ filter: OBSERVED }, view);
      b.onResolve({ filter: REFUSED }, view);
      b.onLoad({ filter: /.*/, namespace: NS }, (args) => ({
        contents: viewSource(args.path),
        loader: "js",
        resolveDir: process.cwd(),
      }));
    },
  };
}
