// k.contract Contract, E1513: a library's module contract is the one `contract()` call in the file its `package.json`
// `exports["./contract"]` names (at `keel`, else the target Node imports). Any other file of the library, a second
// `*.contract.ts` among them, is E1513 naming that file; so is a library that declares no `./contract`; a second call,
// another id or another export name in that file is E1513 as in an app module. A `./contract` naming a file that is no
// `src/` `*.contract.ts` (a `dist/` file, `src/index.ts`, an `unsafe/` file) holds no contract. An app module keeps its own rule.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const LIB = "node_modules/@acme/status";
const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: [] } })\n`;
const pkg = (contract: string | null, raw?: string) =>
  JSON.stringify({
    name: "@acme/status",
    version: "1.0.0",
    type: "module",
    keel: "library",
    exports: {
      ".": { keel: "./src/index.ts", default: "./dist/src/index.js" },
      ...(contract === null ? {} : { "./contract": { keel: contract, default: "./dist/src/x.js" } }),
      ...(raw === undefined ? {} : { "./contract": raw }),
    },
  });
const CONTRACT = "import { contract } from '@keel/router/contract'\n";
const call = (id: string, name = id, key = `${id}.page`) =>
  `export const ${name} = contract('${id}', { '${key}': { path: '/status' } })\n`;

const e1513 = (contract: string | null, files: Record<string, string>, raw?: string) =>
  check(
    [
      { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/status"]) },
      { path: `${LIB}/package.json`, source: pkg(contract, raw) },
      { path: `${LIB}/module.ts`, source: manifest("status", []) },
      ...Object.entries(files).map(([p, source]) => ({ path: p.startsWith("modules/") ? p : `${LIB}/${p}`, source })),
    ],
    { types: false },
  )
    .diagnostics.filter((d) => d.code === "E1513")
    .map((d) => [d.path, d.message]);

it("the one contract() in the file ./contract names is no E1513", () => {
  expect(e1513("./src/status.contract.ts", { "src/status.contract.ts": `${CONTRACT}${call("status")}` })).toEqual([]);
});

it("a second contract file of the library is E1513 naming the ./contract file", () => {
  expect(
    e1513("./src/status.contract.ts", {
      "src/status.contract.ts": `${CONTRACT}${call("status")}`,
      "src/other.contract.ts": `${CONTRACT}${call("status", "status", "status.other")}`,
    }),
  ).toEqual([[`${LIB}/src/other.contract.ts`, "contract() belongs in src/status.contract.ts"]]);
});

it("a library that declares no ./contract holds no contract() anywhere", () => {
  expect(e1513(null, { "src/status.contract.ts": `${CONTRACT}${call("status")}` })).toEqual([
    [`${LIB}/src/status.contract.ts`, "contract() belongs in the file a ./contract export names"],
  ]);
});

it("in the ./contract file: a second call, another id and another export name are each E1513", () => {
  const at = "./src/status.contract.ts";
  expect(
    e1513(at, { "src/status.contract.ts": `${CONTRACT}${call("status")}${call("status", "again")}` }).map((d) => d[1]),
  ).toEqual(["a second contract() call; src/status.contract.ts holds one"]);
  expect(e1513(at, { "src/status.contract.ts": `${CONTRACT}${call("shop")}` }).map((d) => d[1])).toEqual([
    "contract id must be 'status', the module of src/status.contract.ts",
  ]);
  expect(e1513(at, { "src/status.contract.ts": `${CONTRACT}${call("status", "page")}` }).map((d) => d[1])).toEqual([
    "export the contract as `status` from src/status.contract.ts",
  ]);
});

it("an app module's contract keeps its own home, a library's ./contract beside it", () => {
  expect(
    e1513("./src/status.contract.ts", {
      "src/status.contract.ts": `${CONTRACT}${call("status")}`,
      "modules/shop/shop.contract.ts": `${CONTRACT}${call("shop")}`,
      "modules/shop/extra.ts": `${CONTRACT}${call("shop", "shop", "shop.extra")}`,
    }),
  ).toEqual([["modules/shop/extra.ts", "contract() belongs in modules/shop/shop.contract.ts"]]);
});

it("a ./contract naming no src/*.contract.ts file holds no contract: dist/ alone, an index, an unsafe/ file", () => {
  const files = {
    "src/status.contract.ts": `${CONTRACT}${call("status")}`,
    "src/index.ts": `${CONTRACT}${call("status")}`,
    "unsafe/status.contract.ts": `${CONTRACT}${call("status")}`,
  };
  for (const [raw, shown] of [
    ["./dist/status.contract.js", "dist/status.contract.js"],
    ["./src/index.ts", "src/index.ts"],
    ["./unsafe/status.contract.ts", "unsafe/status.contract.ts"],
  ])
    expect(e1513(null, files, raw), raw).toEqual(
      ["src/index.ts", "src/status.contract.ts", "unsafe/status.contract.ts"].map((p) => [
        `${LIB}/${p}`,
        `contract() belongs in a src/*.contract.ts file, not ${shown}`,
      ]),
    );
});
