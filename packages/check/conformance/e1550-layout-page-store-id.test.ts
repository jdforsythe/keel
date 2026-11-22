// Spec: k.server, Conformance "A layout whose loader names factory `a` and a page under it whose loader names `b`, where `b` spreads `a()` and both create store id `x.s`, is one E1550 in `keel check` at the page loader's `stores` value naming `a`, `b`, `x.s` and the layout's id, and `createApp` throws E1550; with both loaders naming `a`, neither, and a GET of the page answers 200 with `a` run once."
// Spec: k.server, Rules "E1550 two `stores` factories the loaders of one route chain (its layouts' and its page's) name create one store id: `keel check` at the deeper loader's `stores` value, naming both factories, the id and the other route id, reading a factory as E1558 reads a loader `fn` (a top-level function or `const`, or an import of one; its ids the literal `id` of each `store` call in its body and in each factory it calls); one it cannot read is not judged there"
// Seed: 1337 (property below).
// Not built yet: the cases that need the E1550 rule are `test.skip`; the builder changes `test.skip` to `test` in each (the E1550 fixture in
// fixtures-by-code.ts and the NO_FIX line in fix-diffs.test.ts are for a conformance writer after the build).
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MANIFEST = `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n`;
const CONTRACT = `import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.layout': { layout: true }, 'a.page': { path: '/p' } })\n`;
const HEAD = `import { loader } from '@keel/router'
import { ok, s } from '@keel/schema'
import { store } from '@keel/store'
import { a as c } from './a.contract.ts'
const Out = s.object({})
const S = s.object({})
`;

/** Layout `a.layout` names `layoutStores`, page `a.page` names `pageStores`; the page's `stores` value is on its own line. */
const project = (factories: string, layoutStores: string, pageStores: string): { files: Files; source: string } => {
  const source = `${HEAD}${factories}
export const L = loader(c, 'a.layout', { output: Out, stores: ${layoutStores} }, async () => ok({}))
export const P = loader(
  c,
  'a.page',
  {
    output: Out,
    stores: ${pageStores},
  },
  async () => ok({}),
)
`;
  return {
    source,
    files: [
      { path: "modules/a/module.ts", source: MANIFEST },
      { path: "modules/a/a.contract.ts", source: CONTRACT },
      { path: "modules/a/a.server.ts", source },
    ],
  };
};
const found = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1550");

const TWO = (id: string): string =>
  `const a = () => ({ s: store(S, {}, { id: '${id}' }) })\nconst b = () => ({ ...a(), t: store(S, {}, { id: '${id}' }) })`;

test.skip("A layout whose loader names factory `a` and a page under it whose loader names `b`, where `b` spreads `a()` and both create store id `x.s`, is one E1550 in `keel check` at the page loader's `stores` value naming `a`, `b`, `x.s` and the layout's id", () => {
  const { files, source } = project(TWO("x.s"), "a", "b");
  const d = found(files);
  expect(d).toHaveLength(1);
  const line = source.split("\n").findIndex((l) => l.trim() === "stores: b,") + 1;
  expect(d[0]?.path).toBe("modules/a/a.server.ts");
  expect(d[0]?.line).toBe(line);
  const text = JSON.stringify(d[0]);
  for (const part of ["a", "b", "x.s", "a.layout"]) expect(text).toContain(part);
});

test.skip("E1550 with both loaders naming `a`, none", () => {
  const { files } = project(TWO("x.s"), "a", "a");
  expect(found(files)).toEqual([]);
});

test.skip("E1550 two factories whose store ids differ are none", () => {
  const { files } = project(
    "const a = () => ({ s: store(S, {}, { id: 'x.s' }) })\nconst b = () => ({ t: store(S, {}, { id: 'x.t' }) })",
    "a",
    "b",
  );
  expect(found(files)).toEqual([]);
});

test.skip("E1550 a factory it cannot read is not judged there", () => {
  const { files } = project(
    "declare const make: () => Record<string, never>\nconst a = make\nconst b = () => ({ s: store(S, {}, { id: 'x.s' }) })",
    "a",
    "b",
  );
  expect(found(files)).toEqual([]);
});

test.skip("property: for any store id, two distinct factories of one route chain creating it are one E1550 and the same factory twice is none", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{1,6}\.[a-z]{1,6}$/), (id) => {
      expect(found(project(TWO(id), "a", "b").files)).toHaveLength(1);
      expect(found(project(TWO(id), "a", "a").files)).toEqual([]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
