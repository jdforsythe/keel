import type { Plugin } from "esbuild";
import { RECORDED_BUILTINS } from "./RECORDED_BUILTINS.ts";
import { REFUSED_BUILTINS } from "./REFUSED_BUILTINS.ts";

const NS = "keel-observe";
/** The Node modules whose imports in a build-time evaluation bundle go through the bundle's own view. */
const OBSERVED = /^(?:node:)?(?:fs|fs\/promises|process|module)$/;
const escaped = REFUSED_BUILTINS.map((m) => m.replace("/", "\\/")).join("|");
/** The built-ins whose imports get a view that refuses each call (`REFUSED_BUILTINS`) or records it (`RECORDED_BUILTINS`). */
const REFUSED = new RegExp(`^(?:node:)?(?:${escaped}|${RECORDED_BUILTINS.join("|")})$`);

/** A native addon, whose import fails the bundle (E1050). */
const ADDON = /\.node$/;

/** The view each observed module's imports get, a binding of `OBSERVE_BANNER`. */
const VIEWS: Readonly<Record<string, string>> = {
  fs: "__keelFs.fs",
  "fs/promises": "__keelFs.promises",
  process: "__keelProcess",
  module: "__keelModule",
};

/**
 * The source of the view module of `name`: a CommonJS module whose `module.exports` is the view, so each named
 * import is read from the view where the code uses it, not when it is imported (a fact is recorded only when read).
 */
function viewSource(name: string): string {
  const own = RECORDED_BUILTINS.includes(name) ? "__keelRecordedView" : "__keelRefusedView";
  return `module.exports = ${VIEWS[name] ?? `${own}(${JSON.stringify(name)})`};`;
}

/**
 * The esbuild plugin of a build-time evaluation bundle that observes its reads (k.derived Derivation cache): each
 * import of `node:fs`, `node:fs/promises`, `node:process` or `node:module` (with or without `node:`), static, a literal
 * `require` or a literal `import()`, gets a module of the bundle's own whose exports are its view (`OBSERVE_BANNER`).
 * An import of a built-in of `REFUSED_BUILTINS` gets the view whose every call is refused, of `RECORDED_BUILTINS` the
 * view whose every call is recorded; an import of a `.node` addon fails the bundle at that import; a refusal is E1050
 * (k.compiler Build-time evaluation).
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
