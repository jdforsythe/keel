// k.check App code, k.reactive E1207: no lifted range lifts E1207, a library's `unsafe/` file's included; an app
// module's `unsafe/` range and a library's file outside a range report it too.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: [] } })\n`;
const project = [
  { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"]) },
  {
    path: `${LIB}/package.json`,
    source: JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" }),
  },
  { path: `${LIB}/module.ts`, source: manifest("charts", []) },
];
const LIFTED =
  "import { scope } from '@keel/reactive'\nimport { unsafe } from './unsafe.ts'\nexport const detached = <T>(fn: () => T): T =>\n  unsafe('a scope declared at module level has no owner to nest in', () => scope(() => undefined, { detached: true }).run(fn))\n";
const PLAIN =
  "import { scope } from '@keel/reactive'\nexport const plain = scope(() => undefined, { detached: true })\n";
const e1207 = (path: string, source: string): number =>
  check([...project, { path, source }], { types: false }).diagnostics.filter(
    (d) => d.code === "E1207" && d.path === path,
  ).length;

it("E1207 inside a library's lifted range is reported", () => {
  expect(e1207(`${LIB}/unsafe/detached.ts`, LIFTED)).toBe(1);
});

it("E1207 in an app module's lifted range, and in a library file outside one, is reported", () => {
  expect(e1207("modules/shop/unsafe/detached.ts", LIFTED)).toBe(1);
  expect(e1207(`${LIB}/src/plain.ts`, PLAIN)).toBe(1);
});
