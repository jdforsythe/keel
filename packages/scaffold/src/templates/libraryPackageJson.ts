import { jsonText } from "../internal/jsonText.ts";

/**
 * The `@keel/*` packages a library's files import, and those the compiler's output of its JSX imports (`@keel/reactive`,
 * `@keel/runtime-dom`): peers, so they resolve to the app's copies (k.library-pack Package).
 */
const PEERS = ["@keel/compiler", "@keel/reactive", "@keel/runtime-dom", "@keel/schema", "@keel/ui"];

/**
 * `package.json` of a library (k.library-pack Scaffold): `"keel": "library"`, the `keel` condition first in `exports`,
 * the published `files`, the build, check, test and prepack scripts, and the `@keel/*` packages it imports as
 * `peerDependencies` at `^<version>` (the scaffolding `@keel/cli`'s), each also a dev dependency beside `@keel/cli`
 * and `@keel/testing`, so the library's own `keel check`, `keel test` and build resolve them, and `@keel/router`,
 * `@keel/server` and `playwright-core` (pinned) that its `keel test --e2e` host project and browser need (k.e2e Libraries).
 */
export function libraryPackageJson(name: string, version: string): string {
  const v = `^${version}`;
  const pkg = {
    name,
    version: "0.1.0",
    type: "module",
    keel: "library",
    exports: { ".": { keel: "./src/index.ts", types: "./dist/src/index.d.ts", default: "./dist/src/index.js" } },
    files: ["module.ts", "src", "dist", ".keel/ledger.json", "README.md"],
    scripts: {
      build: "tsc -p tsconfig.build.json",
      check: "keel check",
      test: "keel test",
      prepack: "tsc -p tsconfig.build.json && keel pack --check",
    },
    peerDependencies: Object.fromEntries(PEERS.map((p) => [p, v])),
    devDependencies: {
      "@keel/cli": v,
      ...Object.fromEntries(PEERS.map((p) => [p, v])),
      "@keel/router": v,
      "@keel/server": v,
      "@keel/testing": v,
      "@types/node": "^22",
      "happy-dom": "^21.0.4",
      "playwright-core": "1.65.0",
      typescript: "^5.6",
      vite: "^8.3.6",
      vitest: "^4.1.12",
    },
  };
  return `${jsonText(pkg)}\n`;
}
