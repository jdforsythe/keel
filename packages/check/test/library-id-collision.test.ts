// k.library E1166: a library whose id an app module or another library holds is E1166 alone. Its files are read where
// they lie, not under `modules/<id>/`, so they are not taken for the holder's files: no E1513 at the app module's own
// contract, no E1154 for an export the other library's files hold.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const manifest = (id: string, deps: string[], exports: string[] = []) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: ${JSON.stringify(exports).replaceAll('"', "'")} } })\n`;
const LEDGER = JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, exports: [] });
const library = (name: string, id: string) => {
  const root = `node_modules/${name}`;
  return [
    {
      path: `${root}/package.json`,
      source: JSON.stringify({
        name,
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": "./src/index.ts" },
      }),
    },
    { path: `${root}/module.ts`, source: manifest(id, [], ["Badge"]) },
    { path: `${root}/.keel/ledger.json`, source: LEDGER },
    { path: `${root}/src/index.ts`, source: "export { default as Badge } from './Badge.ts'\n" },
    { path: `${root}/src/Badge.ts`, source: "export default function Badge(): null {\n  return null\n}\n" },
  ];
};
const errors = (files: { path: string; source: string }[]) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code.startsWith("E"))
    .map((d) => `${d.code} ${d.path}`);

it("a library holding an app module's id is E1166 alone", () => {
  expect(
    errors([
      { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"]) },
      {
        path: "modules/shop/shop.contract.ts",
        source:
          "import { contract } from '@keel/router/contract'\nexport const shop = contract('shop', { 'shop.home': { path: '/' } })\n",
      },
      ...library("@acme/charts", "shop"),
    ]),
  ).toEqual(["E1166 modules/shop/module.ts"]);
});

it("two libraries holding one id are E1166 at each entry alone", () => {
  expect(
    errors([
      { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts", "@acme/charts2"]) },
      ...library("@acme/charts", "charts"),
      ...library("@acme/charts2", "charts"),
    ]),
  ).toEqual(["E1166 modules/shop/module.ts", "E1166 modules/shop/module.ts"]);
});
