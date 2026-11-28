import { isBuiltin } from "node:module";
import type { Plugin } from "esbuild";

const NS = "keel-observe";
/** A name that may be a Node built-in (`isBuiltin` decides). */
const NAME = /^(?:node:)?[a-z_][a-z0-9_/]*$/;
/** A native addon, whose import fails the bundle (E1050). */
const ADDON = /\.node$/;

/**
 * The esbuild plugin of a build-time evaluation bundle that observes its reads (k.derived Derivation cache): each
 * import of a Node built-in (with or without `node:`), static, a literal `require` or a literal `import()`, gets a
 * CommonJS module of the bundle's own whose `module.exports` is the built-in's view (`__keelBuiltin` of
 * `OBSERVE_BANNER`), so each named import is read from the view where the code uses it, not when it is imported. A
 * built-in `HOST_VIEWS` does not list gets a view refusing each member; an import of a `.node` addon fails the bundle
 * at that import; a refusal is E1050 (k.compiler Build-time evaluation).
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
      b.onResolve({ filter: NAME }, (args) => (isBuiltin(args.path) ? { path: args.path, namespace: NS } : undefined));
      b.onLoad({ filter: /.*/, namespace: NS }, (args) => ({
        contents: `module.exports = __keelBuiltin(${JSON.stringify(args.path)});`,
        loader: "js",
        resolveDir: process.cwd(),
      }));
    },
  };
}
