// k.library In an app: a library file's bare import of a package that is not a library is judged as the same import in
// an app module's file (`modules/<id>/<f>`), and is no E1163; the package resolves from the library's own folder.
import fc from "fast-check";
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: [] } })\n`;

const library = [
  { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"]) },
  {
    path: `${LIB}/package.json`,
    source: JSON.stringify({
      name: "@acme/charts",
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
    }),
  },
  { path: `${LIB}/module.ts`, source: manifest("charts", []) },
  {
    path: "node_modules/@other/plain/package.json",
    source: JSON.stringify({ name: "@other/plain", version: "1.0.0" }),
  },
];

/** The codes and locations `check()` reports for `source` at `path`, beside the library project. */
const found = (path: string, source: string): string[] =>
  check([...library, { path, source }], { types: false })
    .diagnostics.filter((d) => d.path === path)
    .map((d) => `${d.code}:${d.line}:${d.col}`)
    .sort();

const SPECIFIERS = ["@other/plain", "@other/plain/sub", "node:fs", "left-pad", "@keel/store/internal"];

it("a bare import in a library file reports what it reports in an app module's file at the same place, and no E1163", () => {
  fc.assert(
    fc.property(fc.constantFrom(...SPECIFIERS), fc.constantFrom("import", "reexport", "dynamic"), (spec, form) => {
      const source =
        form === "import"
          ? `import x from '${spec}'\nexport const y = x\n`
          : form === "reexport"
            ? `export { x } from '${spec}'\n`
            : `export const y = () => import('${spec}')\n`;
      const inLibrary = found(`${LIB}/src/a.ts`, source);
      expect(inLibrary).toEqual(found("modules/charts/src/a.ts", source));
      expect(inLibrary.some((c) => c.startsWith("E1163"))).toBe(false);
    }),
    { seed: 1337, numRuns: 30 },
  );
});
