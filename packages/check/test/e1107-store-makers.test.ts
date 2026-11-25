// k.leave E1107 with k.library In an app: a library function that builds a store from a schema its caller passes (a
// store maker) is judged at each call in client-reachable code, every argument read as the state; the library's own
// `store` call, unreadable only at the function's parameters, is not judged there. `s.enum` values are no schema.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[], clientPii: string[] = []) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], clientPii: ${JSON.stringify(clientPii).replaceAll('"', "'")}, public: { exports: ['chart', 'wrap', 'leaky'] } })\n`;
const CHART = [
  "import { s } from '@keel/schema'",
  "import { store } from '@keel/store'",
  "export function chart(id: string, spec: { data: unknown; states: string[] }) {",
  "  const [first, ...rest] = spec.states",
  "  const make = (sid: string) => store(s.object({ state: s.enum([first, ...rest]), data: spec.data }), {}, { id: sid })",
  "  return make(id)",
  "}",
  "export const wrap = (id: string, data: unknown) => chart(id, { data, states: ['a'] })",
  "export function leaky(id: string) {",
  "  const local = make()",
  "  return store(s.object({ data: local }), {}, { id })",
  "}",
  "function make() { return s.string() }",
  "",
].join("\n");
const page = (body: string): SourceFile => ({
  path: "modules/shop/Page.tsx",
  source: `import { s } from '@keel/schema'\nimport { chart, wrap } from '@acme/charts'\nimport * as c from '@acme/charts'\n${body}\nexport default function Page() {\n  return null\n}\n`,
});
const project = (files: SourceFile[], clientPii: string[] = []): SourceFile[] => [
  { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"], clientPii) },
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
  { path: `${LIB}/src/index.ts`, source: "export { chart, wrap, leaky } from './chart.ts'\n" },
  { path: `${LIB}/src/chart.ts`, source: CHART },
  ...files,
];
const hits = (files: SourceFile[]) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1107")
    .map((d) => `${d.path}:${d.line} ${d.message}`);

const PII = "store state reaching #k-state holds .pii('contact'), not in clientPii";

it("the library's store call fed by its parameters is not judged there; one fed by an unreadable local is", () => {
  expect(hits(project([page("")]))).toEqual([
    `${LIB}/src/chart.ts:11 store state not readable at local; cannot show its .pii() classes`,
  ]);
});

it("a call of the store maker is judged at the caller, by name, through a maker calling it, or as a namespace member", () => {
  const data = "s.object({ e: s.string().pii('contact') })";
  expect(hits(project([page(`export const a = chart('shop.a', { data: ${data}, states: ['x'] })`)]))).toContain(
    `modules/shop/Page.tsx:4 ${PII}`,
  );
  expect(hits(project([page(`export const a = wrap('shop.a', ${data})`)]))).toContain(`modules/shop/Page.tsx:4 ${PII}`);
  expect(hits(project([page(`export const a = c.chart('shop.a', { data: ${data}, states: [] })`)]))).toContain(
    `modules/shop/Page.tsx:4 ${PII}`,
  );
});

it("clientPii listing the class, a schema with none, or a server-only caller clears it", () => {
  const data = "s.object({ e: s.string().pii('contact') })";
  const call = `export const a = chart('shop.a', { data: ${data}, states: ['x'] })`;
  const own = (h: string[]) => h.filter((x) => x.startsWith("modules/"));
  expect(own(hits(project([page(call)], ["contact"])))).toEqual([]);
  expect(own(hits(project([page("export const a = chart('shop.a', { data: s.string(), states: ['x'] })")])))).toEqual(
    [],
  );
  const server = { path: "modules/shop/load.server.ts", source: page(call).source };
  expect(own(hits(project([server])))).toEqual([]);
});

it("a caller passing a schema check cannot read is told so at the call", () => {
  const got = hits(project([page("const make = () => s.string()\nexport const a = chart('shop.a', { data: make(), states: [] })")]));
  expect(got).toContain("modules/shop/Page.tsx:5 store state not readable at make(); cannot show its .pii() classes");
});
