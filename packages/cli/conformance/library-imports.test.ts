// k.library, In an app, the clause on a library file's bare import, quoted whole (the sentence closes the `keel check` clause, which is quoted whole):
// In an app (check): "`keel check` reads them and runs every rule over them, its type pass included, against the app's `tokens.ts`, kernel packages and `topology.ts`. Wherever a section reads app code or a file under `modules/<id>/` (k.check App code, k.boundary Reach), it reads a library's file `<f>` as it reads `modules/<id>/<f>`, `<id>` the library's, and its `unsafe/` files with their lifted ranges; a section's exclusion of `node_modules/` does not cover library files. A diagnostic in a library file is the app's: located at `node_modules/<name>/<f>`, whichever `node_modules` holds it, and carrying no `fix`. Nothing in the app turns a rule off for a library file. A bare import there is read as in an app file and resolves from the library's folder, so its package is one of the library's `dependencies`; it is no E1163."
// Rules: "E1163 a library file whose relative import, re-export or literal `import()` resolves outside its package folder, at the specifier, or a library manifest `deps` entry that does not begin with `@`, at the entry (fix: none; the entry names no module, so it is no E1153 edge and no E1165)"
// Reach (k.boundary, for the two cases on the client reach): "**Reach.** Client-reachable code (E1004 and E1571; E1107 has its own, k.leave), with a `topology.ts`: a file under `modules/<id>/`, not server-only, of a `node` or `static` module (one such a deployable lists); a file of a `client` module, for imports of another module's server-only files; and a project file outside `node_modules/` a client entry reaches by value imports, re-exports and literal `import()`, not through a server-only file. Client entries: each route `component` of a `node` or `static` module and every file of a `client` one. No `topology.ts`: every file but server-only ones. A `routes.ts` may import server-only files by value; a specifier with a query names its file; package imports are not followed (E1007 covers them). An E1004 found through a chain ends `(<entry> -> … -> <file>)`."
// Seed: 1337 (no generated input). Binary runs: 7 (`keel check` and `keel build` for a package the library declares, the same two for one only the app holds, one `keel check` for a `node:` import in a library file and in an app module's, one for a server-only import in a library file the page reaches, one for a `node:` import in a library file nothing reaches). A route component reaching a library through its package name reaches the files its `exports` `keel` target names and what those import (a reading: k.library names no sentence for it); a library file no client entry reaches is no browser file.
// ASSUMPTIONS (spec silent): a plain package is `plainpkg` (`"type": "module"`, a `tag` export holding a canary, with types); one the library declares is installed in the library's own `node_modules` and listed in its
// `package.json` `dependencies`; one only the app holds is installed in the project's `node_modules` and the library lists none. Resolution "from the library's folder" is Node's: the library's `node_modules`, then each
// folder above it. The spec names no rule for a package the library imports and does not list; it says only that the package is one of its `dependencies` and that the import is no E1163, which is what is asserted for the
// undeclared case (a hole in the gate if that is meant to be refused: nothing flags it). An import an app file is refused for is `import { readFileSync } from 'node:fs'` (E1759, k.check).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import {
  LIB,
  NAME,
  type Tree,
  cleanup,
  diags,
  filesUnder,
  keel,
  library,
  materialize,
  siteTree,
} from "./library-support.ts";

const CANARY = "PLAIN-TAG-1337";
const PLAIN = (root: string): Tree => ({
  [`${root}/package.json`]: JSON.stringify({
    name: "plainpkg",
    version: "1.0.0",
    type: "module",
    main: "index.js",
    types: "index.d.ts",
  }),
  [`${root}/index.js`]: `export const tag = '${CANARY}'\n`,
  [`${root}/index.d.ts`]: "export const tag: string\n",
});
const BADGE_USING =
  "import { Box, Text } from '@keel/ui'\nimport { tag } from 'plainpkg'\nexport default function Badge(props: { id: string }) {\n  return (\n    <Box id={`${props.id}.box`} p=\"2\">\n      <Text id={`${props.id}.text`}>{tag}</Text>\n    </Box>\n  )\n}\n";
const libPkg = (dependencies: Record<string, string> | undefined): string =>
  JSON.stringify({
    name: NAME,
    version: "1.0.0",
    type: "module",
    keel: "library",
    ...(dependencies === undefined ? {} : { dependencies }),
    exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
  });

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const project = (extra: Tree, dependencies: Record<string, string> | undefined): string => {
  const dir = materialize({
    ...siteTree([library({ files: { "package.json": libPkg(dependencies), "src/Badge.tsx": BADGE_USING } })]),
    ...extra,
  });
  dirs.push(dir);
  return dir;
};
const pageOf = (dir: string): string => readFileSync(join(dir, "dist/site/index.html"), "utf8");
const htmlAndAssets = (dir: string): string =>
  [
    pageOf(dir),
    ...filesUnder(join(dir, "dist/site"))
      .filter((p) => p.endsWith(".js"))
      .map((p) => readFileSync(p, "utf8")),
  ].join("\n");

test("A bare import there is read as in an app file and resolves from the library's folder, so its package is one of the library's `dependencies`; it is no E1163: a package the library lists, installed beside it, builds and checks clean", () => {
  const dir = project(PLAIN(`${LIB}/node_modules/plainpkg`), { plainpkg: "1.0.0" });
  const checked = keel(dir, ["check"]);
  expect(checked.records.filter((x) => x.kind === "diag")).toEqual([]);
  const built = keel(dir, ["build"]);
  expect(built.status).toBe(0);
  expect(htmlAndAssets(dir)).toContain(CANARY);
}, 600_000);

test("A bare import there is read as in an app file and resolves from the library's folder; it is no E1163: a package only the app installs, which the library does not list, is no E1163 and resolves as Node's resolution from the library's folder finds it", () => {
  const dir = project(PLAIN("node_modules/plainpkg"), undefined);
  const checked = keel(dir, ["check"]);
  expect(diags(checked, "E1163")).toEqual([]);
  const built = keel(dir, ["build"]);
  expect(built.status).toBe(0);
  expect(htmlAndAssets(dir)).toContain(CANARY);
}, 600_000);

test("A bare import there is read as in an app file: an import an app file is refused for (`node:fs`, E1759) is refused at the library's path with the same code, and in an app module's file alike", () => {
  const source =
    "import { readFileSync } from 'node:fs'\nimport { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return <Box id={`${props.id}.box`}>{String(readFileSync)}</Box>\n}\n";
  const dir = materialize({
    ...siteTree([library({ files: { "src/Badge.tsx": source } })]),
    "modules/shop/Own.tsx": source.replace("Badge", "Own"),
  });
  dirs.push(dir);
  const hits = diags(keel(dir, ["check"]), "E1759");
  const inLib = hits.filter((x) => x.path === `${LIB}/src/Badge.tsx`);
  expect(inLib.length).toBeGreaterThanOrEqual(1);
  for (const h of inLib) expect(h.fix).toBeUndefined();
  expect(hits.filter((x) => x.path === "modules/shop/Own.tsx").length).toBe(inLib.length);
}, 600_000);

test("a library file the client reaches (a page renders the library, its `exports` entry names the file) importing a server-only file is one E1004 at the library's path; a library file nothing reaches importing `node:fs` is no E1759", () => {
  const dir = materialize({
    ...siteTree([
      library({
        files: {
          "src/keys.server.ts": "export const key = 'k'\n",
          "src/Badge.tsx":
            "import { Box } from '@keel/ui'\nimport { key } from './keys.server.ts'\nexport default function Badge(props: { id: string }) {\n  return <Box id={`${props.id}.box`}>{key}</Box>\n}\n",
          "src/Unreached.ts": "import { readFileSync } from 'node:fs'\nexport const r = readFileSync\n",
        },
      }),
    ]),
  });
  dirs.push(dir);
  const checked = keel(dir, ["check"]);
  const reached = diags(checked, "E1004");
  expect(reached.map((x) => x.path)).toEqual([`${LIB}/src/Badge.tsx`]);
  expect(reached[0]?.fix).toBeUndefined();
  expect(diags(checked, "E1759").filter((x) => x.path === `${LIB}/src/Unreached.ts`)).toEqual([]);
}, 600_000);
