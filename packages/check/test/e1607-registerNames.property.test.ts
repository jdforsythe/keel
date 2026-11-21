// k.data Rules (E1607): the aliased and namespace forms of `register`, one project per root, and the order property.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";

const manifest = (dir: string) => ({
  path: `${dir}modules/notes/module.ts`,
  source:
    "import { module } from '@keel/compiler'\nexport default module({ id: 'notes', deps: [], capabilities: ['notes.mongo'], public: { exports: [] } })\n",
});
const e1607 = (files: { path: string; source: string }[]) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === "E1607");
const FILE = "modules/notes/mongoNotes.server.ts";

test("an aliased import and a namespace import of `register` are checked as the direct one", () => {
  const aliased = "import { register as reg } from '@keel/ctx'\nexport const a = reg('mongo', impls)\n";
  const spaced = "import * as k from '@keel/ctx'\nexport const a = k.register('mongo', impls)\n";
  expect(e1607([manifest(""), { path: FILE, source: aliased }])).toHaveLength(1);
  expect(e1607([manifest(""), { path: FILE, source: spaced }])).toHaveLength(1);
});

test("a `register` of another package is not checked", () => {
  const other = "import { register } from './local.ts'\nexport const a = register('mongo', impls)\n";
  expect(e1607([manifest(""), { path: FILE, source: other }])).toEqual([]);
});

test("two projects registering one name are no E1607; one project registering it in two files is one", () => {
  const src = "import { register } from '@keel/ctx'\nexport const a = register('notes.mongo', impls)\n";
  const top = "export default { web: { modules: ['notes'], adapter: 'node' } }\n";
  const files = (dir: string) => [
    manifest(dir),
    { path: `${dir}topology.ts`, source: top },
    { path: `${dir}${FILE}`, source: src },
  ];
  expect(e1607([...files("apps/a/"), ...files("apps/b/")])).toEqual([]);
  expect(e1607([...files("apps/a/"), { path: "apps/a/modules/notes/other.server.ts", source: src }])).toHaveLength(1);
});

test("of n files registering one name, the n - 1 whose paths sort after the first are reported, in any input order", () => {
  const src = "import { register } from '@keel/ctx'\nexport const a = register('notes.mongo', impls)\n";
  fc.assert(
    fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 5 }), (stems) => {
      const files = stems.map((s) => ({ path: `modules/notes/${s}.server.ts`, source: src }));
      const found = e1607([manifest(""), ...files]).map((d) => d.path);
      const sorted = files.map((f) => f.path).sort();
      expect(found.sort()).toEqual(sorted.slice(1));
    }),
    { seed: 1337, numRuns: 25 },
  );
});
