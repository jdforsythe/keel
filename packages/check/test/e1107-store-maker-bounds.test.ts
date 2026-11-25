// k.leave E1107 Store makers, where the read stops: a maker's own classes are its callers', a maker used as a value
// is reported, a spread before a path leaves it unread, a chain deeper than 16 is reported, an app wrapper is judged
// as app code and a library's own call in a non-maker function is the library's.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[], clientPii: string[] = []) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], clientPii: ${JSON.stringify(clientPii).replaceAll('"', "'")}, public: { exports: ['chart'] } })\n`;
const CHART = [
  "import { s } from '@keel/schema'",
  "import { store } from '@keel/store'",
  "export function chart(id: string, spec: { data: unknown }) {",
  "  return store(s.object({ data: spec.data }), {}, { id })",
  "}",
  "export function secret(id: string, spec: { data: unknown }) {",
  "  return store(s.object({ ssn: s.string().pii('ssn'), data: spec.data }), {}, { id })",
  "}",
  "export function fixed(id: string) {",
  "  return chart(id, { data: s.object({ e: s.string().pii('contact') }) })",
  "}",
  "export const spread = (...a: [string, { data: unknown }]) => chart(...a)",
  "",
].join("\n");
const INDEX = "export { chart, secret, fixed, spread } from './chart.ts'\nexport { chart as plot } from './chart.ts'\n";
const page = (body: string, path = "modules/shop/Page.tsx"): SourceFile => ({
  path,
  source: `import { s } from '@keel/schema'\nimport { chart, secret, fixed, plot, spread } from '@acme/charts'\nimport * as c from '@acme/charts'\n${body}\nexport default function Page() {\n  return null\n}\n`,
});
const project = (files: SourceFile[], lib = CHART, index = INDEX): SourceFile[] => [
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
  { path: `${LIB}/src/index.ts`, source: index },
  { path: `${LIB}/src/chart.ts`, source: lib },
  ...files,
];
const hits = (files: SourceFile[]) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1107")
    .map((d) => `${d.path}:${d.line} ${d.message}`);
const app = (h: string[]) => h.filter((x) => x.startsWith("modules/"));
const lib = (h: string[]) => h.filter((x) => x.startsWith(LIB));
const P = "s.object({ e: s.string().pii('contact') })";
const PII = (c: string) => `store state reaching #k-state holds .pii('${c}'), not in clientPii`;
const USE = (n: string) => `store maker ${n} used other than as a call; check cannot follow it`;

it("a maker's own pii class is its callers': a clean argument still reports it at the call", () => {
  expect(app(hits(project([page("export const a = secret('shop.a', { data: s.string() })")])))).toEqual([
    `modules/shop/Page.tsx:4 ${PII("ssn")}`,
  ]);
  expect(app(hits(project([page(`export const a = secret('shop.a', { data: ${P} })`)])))).toEqual([
    `modules/shop/Page.tsx:4 store state reaching #k-state holds .pii('ssn', 'contact'), not in clientPii`,
  ]);
});

it("a maker used as a value in client code is reported at its name; one check cannot follow is not judged", () => {
  expect(app(hits(project([page(`const m = chart\nexport const a = m('shop.a', { data: ${P} })`)])))).toEqual([
    `modules/shop/Page.tsx:4 ${USE("chart")}`,
  ]);
  expect(
    app(hits(project([page(`const apply = (f: unknown, x: unknown) => x\nexport const a = apply(chart, ${P})`)]))),
  ).toEqual([`modules/shop/Page.tsx:5 ${USE("chart")}`]);
  expect(app(hits(project([page("export const a = [chart].map((f) => f)")])))).toEqual([
    `modules/shop/Page.tsx:4 ${USE("chart")}`,
  ]);
  expect(app(hits(project([page("export const a = [c.chart, c.fixed]")])))).toEqual([
    `modules/shop/Page.tsx:4 ${USE("c.chart")}`,
  ]);
  expect(app(hits(project([page("const { chart: k } = c\nexport const a = k")])))).toEqual([
    `modules/shop/Page.tsx:4 ${USE("c")}`,
  ]);
});

it("an import alias, a library re-export under another name and an app re-export are followed, not reported", () => {
  const alias = page(`import { chart as ch } from '@acme/charts'\nexport const a = ch('shop.a', { data: ${P} })`);
  expect(app(hits(project([alias])))).toEqual([`modules/shop/Page.tsx:5 ${PII("contact")}`]);
  expect(app(hits(project([page(`export const a = plot('shop.a', { data: ${P} })`)])))).toEqual([
    `modules/shop/Page.tsx:4 ${PII("contact")}`,
  ]);
  const again: SourceFile = {
    path: "modules/shop/charts.ts",
    source: "import { chart } from '@acme/charts'\nexport { chart as draw }\n",
  };
  const user = page(`import { draw } from './charts.ts'\nexport const a = draw('shop.a', { data: ${P} })`);
  expect(app(hits(project([again, user])))).toEqual([`modules/shop/Page.tsx:5 ${PII("contact")}`]);
});

it("a spread argument at or before a path's index leaves it unread, at the call and in a maker calling a maker", () => {
  const pre = `const pre: [string] = ['shop.a']\nexport const a = chart(...pre, { data: ${P} })`;
  expect(app(hits(project([page(pre)])))).toEqual([
    "modules/shop/Page.tsx:5 store state not readable at ...pre; cannot show its .pii() classes",
  ]);
  const got = hits(project([page(`export const a = spread('shop.a', { data: ${P} })`)]));
  expect(app(got)).toEqual([]);
  expect(lib(got)).toContain(`${LIB}/src/chart.ts:12 store state not readable at ...a; cannot show its .pii() classes`);
});

it("a maker deeper than 16 calls is E1107 not readable at each call of it; 16 deep is followed", () => {
  const chain = (n: number) => {
    const fns = ["export const f1 = (d: unknown) => store(s.object({ d }), {}, { id: 'shop.x' })"];
    for (let i = 2; i <= n; i++) fns.push(`export const f${i} = (d: unknown) => f${i - 1}(d)`);
    return ["import { s } from '@keel/schema'", "import { store } from '@keel/store'", ...fns, ""].join("\n");
  };
  const caller = (n: number): SourceFile => ({
    path: "modules/shop/Page.tsx",
    source: `import { s } from '@keel/schema'\nimport { f${n} } from '@acme/charts'\nexport const a = f${n}(${P})\n`,
  });
  const index = "export * from './chart.ts'\n";
  expect(hits(project([caller(16)], chain(16), index))).toEqual([`modules/shop/Page.tsx:3 ${PII("contact")}`]);
  expect(hits(project([caller(18)], chain(18), index))).toEqual([
    `${LIB}/src/chart.ts:20 store state not readable at f17(); cannot show its .pii() classes`,
  ]);
});

it("an app wrapper passing its own parameter is app code; a library's call in a non-maker function is the library's", () => {
  const wrap = `function mk(d: unknown) {\n  return chart('shop.a', { data: d })\n}\nexport const a = mk(${P})`;
  expect(app(hits(project([page(wrap)])))).toEqual([
    "modules/shop/Page.tsx:5 store state not readable at d; cannot show its .pii() classes",
  ]);
  const got = hits(project([page("export const a = fixed('shop.a')")]));
  expect(app(got)).toEqual([]);
  expect(lib(got)).toContain(`${LIB}/src/chart.ts:10 ${PII("contact")}`);
});
