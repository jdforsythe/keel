// k.leave E1107 Store makers with k.library Kind: a maker is followed through every `exports` form a library may
// write (a string target, the string sugar, a `keel` condition, a Node condition, a `./sub` entry), and a call of a
// library holding a `store` use that check cannot follow to a function of its files is reported, never silent.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: ['chart', 'fixed'] } })\n`;
const CHART = [
  "import { s } from '@keel/schema'",
  "import { store } from '@keel/store'",
  "export function chart(id: string, spec: { data: unknown }) {",
  "  return store(s.object({ data: spec.data }), {}, { id })",
  "}",
  "",
].join("\n");
const FIXED = [
  "import { s } from '@keel/schema'",
  "import { store } from '@keel/store'",
  "export function fixed(id: string) {",
  "  return store(s.object({ e: s.string().pii('contact') }), {}, { id })",
  "}",
  "",
].join("\n");
const project = (exports: unknown, page: string, lib = CHART): SourceFile[] => [
  { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"]) },
  {
    path: `${LIB}/package.json`,
    source: JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library", exports }),
  },
  { path: `${LIB}/module.ts`, source: manifest("charts", []) },
  { path: `${LIB}/src/index.ts`, source: "export * from './chart.ts'\n" },
  { path: `${LIB}/src/chart.ts`, source: lib },
  { path: "modules/shop/Page.tsx", source: `import { s } from '@keel/schema'\n${page}\n` },
];
const hits = (files: SourceFile[]) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1107" && d.path.startsWith("modules/"))
    .map((d) => `${d.path}:${d.line} ${d.message}`);
const P = "s.object({ e: s.string().pii('contact') })";
const PII = "modules/shop/Page.tsx:3 store state reaching #k-state holds .pii('contact'), not in clientPii";
const call = `import { chart } from '@acme/charts'\nexport const a = chart('shop.a', { data: ${P} })`;
const UNREAD = (part: string) =>
  `modules/shop/Page.tsx:3 store state not readable at ${part}; cannot show its .pii() classes`;

it("a string target, the string sugar and a keel condition each lead to the maker", () => {
  expect(hits(project({ ".": "./src/index.ts" }, call))).toEqual([PII]);
  expect(hits(project("./src/index.ts", call))).toEqual([PII]);
  expect(hits(project({ ".": { keel: "./src/index.ts", default: "./index.js" } }, call))).toEqual([PII]);
});

it("a conditional entry with no keel is read at the target Node imports", () => {
  expect(hits(project({ ".": { types: "./index.d.ts", import: "./src/index.ts" } }, call))).toEqual([PII]);
  expect(hits(project({ ".": { default: "./src/index.ts" } }, call))).toEqual([PII]);
});

it("a ./sub entry leads to the maker, by name and as a namespace member", () => {
  const exports = { ".": "./src/index.ts", "./charts": { keel: "./src/chart.ts" } };
  const sub = `import { chart } from '@acme/charts/charts'\nexport const a = chart('shop.a', { data: ${P} })`;
  expect(hits(project(exports, sub))).toEqual([PII]);
  const ns = `import * as c from '@acme/charts/charts'\nexport const a = c.chart('shop.a', { data: ${P} })`;
  expect(hits(project(exports, ns))).toEqual([PII]);
});

it("an entry no library file holds leaves a call of a storing library not readable at the call", () => {
  const exports = { ".": { types: "./index.d.ts", default: "./index.js" } };
  expect(hits(project(exports, call))).toEqual([UNREAD("chart()")]);
  const ns = `import * as c from '@acme/charts'\nexport const a = c.chart('shop.a', { data: ${P} })`;
  expect(hits(project(exports, ns))).toEqual([UNREAD("c.chart()")]);
  const fixed = "import { fixed } from '@acme/charts'\nexport const a = fixed('shop.a')";
  expect(hits(project(exports, fixed, FIXED))).toEqual([UNREAD("fixed()")]);
  expect(hits(project({ ".": "./src/index.ts" }, fixed, FIXED))).toEqual([]);
});
