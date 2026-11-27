// The size tool's measurement (tooling/budgets.mjs): the gzipped bytes of one budgeted entry. The entry's own code is
// bundled from its source (minified esm, dependencies external), and for a browser entry a server-only file (`*.server.*`,
// `*.guard.*`) is loaded as the stub a real browser build loads (`browserStub`, packages/compiler), so code no browser
// receives is not counted. A node entry counts everything.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { build } from "esbuild";
import { SERVER_ONLY_NAME } from "../packages/compiler/src/internal/SERVER_ONLY_NAME.ts";
import { browserStub } from "../packages/compiler/src/internal/browserStub.ts";

const ROUTER = "@keel/router/internal";
const CODE = /\.[cm]?[jt]sx?$/;

/** The esbuild plugin that loads each server-only file of a browser bundle as its browser stub. */
export function serverStubs() {
  return {
    name: "keel:server-stubs",
    setup(b) {
      b.onLoad({ filter: CODE }, (args) => {
        if (!SERVER_ONLY_NAME.test(path.basename(args.path))) return null;
        const stub = browserStub(args.path, args.path, path.basename(args.path), ROUTER);
        return stub === null ? null : { contents: stub, loader: "js" };
      });
    },
  };
}

/** The source file of budget entry `name` (`@keel/<pkg>[/<subpath>]`) under `root`, or undefined when there is none. */
export function entryOf(root, name) {
  // A subpath export (`@keel/router/match`) is its own entry: `packages/<pkg>/src/<subpath>/index.ts` (rfc:0071).
  const [pkg, ...sub] = name.replace(/^@keel\//, "").split("/");
  // A subpath with no folder index is the file `packages/<pkg>/src/<subpath>.ts` (`@keel/std-sessions/routes`, 0093).
  const nested = path.join(root, "packages", pkg, "src", ...sub, "index.ts");
  const file = path.join(root, "packages", pkg, "src", `${sub.join("/")}.ts`);
  // A library's `exports` entry names its source under `keel` (`./src/index.server.ts`, k.library-pack).
  const pj = path.join(root, "packages", pkg, "package.json");
  const target = fs.existsSync(pj)
    ? JSON.parse(fs.readFileSync(pj, "utf8")).exports?.[sub.length > 0 ? `./${sub.join("/")}` : "."]?.keel
    : undefined;
  const entry =
    typeof target === "string"
      ? path.join(root, "packages", pkg, target)
      : sub.length > 0 && !fs.existsSync(nested)
        ? file
        : nested;
  return fs.existsSync(entry) ? entry : undefined;
}

/** The minified bundle of `entry` for `platform` (`browser` or `node`), its own code with dependencies external. */
export async function bundleOf(entry, platform) {
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    platform,
    packages: "external",
    write: false,
    logLevel: "silent",
    plugins: platform === "browser" ? [serverStubs()] : [],
  });
  return bundle.outputFiles[0].contents;
}

/** The gzipped bytes of the bundle of `entry` for `platform`. */
export async function gzipBytes(entry, platform) {
  return zlib.gzipSync(await bundleOf(entry, platform)).length;
}
