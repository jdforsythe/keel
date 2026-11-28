// k.check E1753 and k.library In an app: the source pass holds a rule code to one `defineRule` per package (the app's
// files, or one library's); a code two libraries define is the registry's E1753 at the later `deps` entry, not this one.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: [] } })\n`;
const rule = (code: string) =>
  `import { defineRule } from '@keel/check'\nexport const r = defineRule({\n  code: '${code}',\n  message: 'x',\n  explain: 'x',\n  check: () => [],\n})\n`;
const library = (name: string, id: string, files: Record<string, string>) => {
  const root = `node_modules/${name}`;
  return [
    {
      path: `${root}/package.json`,
      source: JSON.stringify({
        name,
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts" } },
      }),
    },
    { path: `${root}/module.ts`, source: manifest(id, []) },
    {
      path: `${root}/.keel/ledger.json`,
      source: JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, exports: [] }),
    },
    { path: `${root}/src/index.ts`, source: "export {}\n" },
    ...Object.entries(files).map(([rel, source]) => ({ path: `${root}/${rel}`, source })),
  ];
};
const e1753 = (files: { path: string; source: string }[]) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1753")
    .map((d) => `${d.path} ${d.message}`);

it("two libraries defining one code are no E1753 of the source pass", () => {
  expect(
    e1753([
      { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/a", "@acme/b"]) },
      ...library("@acme/a", "a", { "src/tools.ts": rule("E2991") }),
      ...library("@acme/b", "b", { "src/tools.ts": rule("E2991") }),
    ]),
  ).toEqual([]);
});

it("one library defining a code twice, and the app twice, are each one E1753", () => {
  expect(
    e1753([
      { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/a"]) },
      { path: "modules/shop/one.ts", source: rule("E2992") },
      { path: "modules/shop/two.ts", source: rule("E2992") },
      ...library("@acme/a", "a", { "src/one.ts": rule("E2991"), "src/two.ts": rule("E2991") }),
    ]),
  ).toEqual([
    "modules/shop/two.ts rule code E2992 already defined at modules/shop/one.ts:3",
    "node_modules/@acme/a/src/two.ts rule code E2991 already defined at modules/a/src/one.ts:3",
  ]);
});
