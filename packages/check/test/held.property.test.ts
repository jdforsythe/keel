import fc from "fast-check";
import { expect, it } from "vitest";
import { check } from "../src/index.ts";
import { parseFile } from "../src/internal/parseFile.ts";
import { topRefs } from "../src/internal/topRefs.ts";

const refs = (source: string, name: string): number =>
  topRefs(parseFile({ path: "a.ts", source }).program).get(name)?.length ?? 0;

it("topRefs resolves by lexical scope: each shadowing form hides the top-level binding, a plain read does not", () => {
  const top = "const shape = { q: 1 }\n";
  const shadows = [
    "function f(shape: number) { return shape }",
    "const g = (shape: number) => shape",
    "function h() { const shape = 2; return shape }",
    "{ let shape = 2; shape++ }",
    "try {} catch (shape) { shape }",
    "for (const shape of [1]) shape",
    "for (let shape = 0; shape < 1; shape++) {}",
    "switch (1) { case 1: { const shape = 1; shape } }",
    "const k = class shape { m() { return shape } }",
    "function v() { if (true) { var shape = 1 } return shape }",
    "function d({ shape }: { shape: number }) { return shape }",
    "function e([shape]: number[]) { return shape }",
  ];
  for (const s of shadows) expect(refs(`${top}${s}\n`, "shape"), s).toBe(0);
  const reads = [
    "export const a = shape.q",
    "export { shape }",
    "export default shape",
    "function f() { return shape }",
    "const { x = shape } = {}",
    "({ shape })",
    "class C { [shape.q] = 1 }",
  ];
  for (const s of reads) expect(refs(`${top}${s}\n`, "shape"), s).toBe(1);
  expect(refs(`${top}export type T = typeof shape\nlet x: typeof shape\n`, "shape")).toBe(0);
  expect(refs(`${top}const o = { shape: 1 }\no.shape\n`, "shape")).toBe(0);
});

const PROJECT = (tail: string) => [
  {
    path: "modules/a/module.ts",
    source:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
  },
  {
    path: "modules/a/q.schema.ts",
    source: `import { s } from '@keel/schema'\nexport const shape = { q: s.string() }\nexport const Search = s.object(shape)\n${tail}`,
  },
  {
    path: "modules/a/a.contract.ts",
    source:
      "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nimport { Search } from './q.schema.ts'\nexport const a = contract('a', { 'a.show': { path: '/a', search: Search, output: s.object({}) } })\n",
  },
];
const unread = (tail: string): number =>
  check(PROJECT(tail), { types: false }).diagnostics.filter((d) => d.code === "E1111").length;

it("property: a write to `shape` behind any shadowing wrapper is clean, and the same write unshadowed is one E1111", () => {
  const wrap = fc.constantFrom(
    (body: string) => `export function f(shape: { x?: unknown }) { ${body} }`,
    (body: string) => `export const f = (shape: { x?: unknown }) => { ${body} }`,
    (body: string) => `export function f() { const shape: { x?: unknown } = {}; ${body} }`,
    (body: string) => `export function f() { try {} catch (shape) { ${body} } }`,
  );
  const write = fc.constantFrom("shape.x = 1", "delete shape.x", "Object.assign(shape, {})", "use(shape)");
  fc.assert(
    fc.property(wrap, write, (w, body) => {
      const declare = "declare const use: (x: unknown) => void\n";
      expect(unread(`${declare}${w(body)}\n`)).toBe(0);
      expect(unread(`${declare}export function g() { ${body} }\n`)).toBe(1);
    }),
    { seed: 1337, numRuns: 16 },
  );
});
