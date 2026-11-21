// Spec: k.data, clause 1 (k.data#1): "In `modules/notes/mongoNotes.server.ts`, `register('notes.mongo', ...)` is no E1607; `register('mongo', ...)`, `register('other.mongo', ...)`, `register('notes.Mongo', ...)` and `register(name, ...)` with `name` a variable are each one E1607, and a second file registering `notes.mongo` is one E1607, in the file whose path sorts later."
// Seed 1337
// ASSUMPTION: the report is at the `register` call (path, line, col of the call expression); the spec says "at the call".
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./module-support.ts";

const FILE = "modules/notes/mongoNotes.server.ts";
const manifest = {
  path: "modules/notes/module.ts",
  source:
    "import { module } from '@keel/compiler'\nexport default module({ id: 'notes', deps: [], capabilities: ['notes.mongo'], public: { exports: [] } })\n",
};
const impl = "const impl = () => ({})\n";
const head = "import { register } from '@keel/ctx'\n";
const call = (arg: string): string =>
  `export const mongoNotes = register(${arg}, { real: impl, shell: impl, sim: impl })\n`;
const src = (arg: string): string => `${head}${impl}${call(arg)}`;
const e1607 = (files: { path: string; source: string }[]) =>
  check([manifest, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1607");

test("`register('notes.mongo', ...)` in modules/notes/mongoNotes.server.ts is no E1607", () => {
  expect(e1607([{ path: FILE, source: src("'notes.mongo'") }])).toEqual([]);
});

test("`register('mongo', ...)` is one E1607, at the call", () => {
  const source = src("'mongo'");
  const found = e1607([{ path: FILE, source }]);
  expect(found).toHaveLength(1);
  expect(found[0]?.path).toBe(FILE);
  expect(found[0]?.line).toBe(source.split("\n").findIndex((l) => l.includes("register('mongo'")) + 1);
});

test("`register('other.mongo', ...)` is one E1607", () => {
  expect(e1607([{ path: FILE, source: src("'other.mongo'") }])).toHaveLength(1);
});

test("`register('notes.Mongo', ...)` is one E1607", () => {
  expect(e1607([{ path: FILE, source: src("'notes.Mongo'") }])).toHaveLength(1);
});

test("`register(name, ...)` with `name` a variable is one E1607", () => {
  const source = `${head}${impl}const name = 'notes.mongo'\n${call("name")}`;
  expect(e1607([{ path: FILE, source }])).toHaveLength(1);
});

test("a name of `notes.` and one lowerCamel segment is no E1607; any other tail is one (property)", () => {
  const camel = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/);
  fc.assert(
    fc.property(camel, (tail) => {
      expect(e1607([{ path: FILE, source: src(`'notes.${tail}'`) }])).toEqual([]);
      expect(e1607([{ path: FILE, source: src(`'notes.${tail}.${tail}'`) }])).toHaveLength(1);
      expect(e1607([{ path: FILE, source: src(`'notes.X${tail}'`) }])).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("a second file registering `notes.mongo` is one E1607, in the file whose path sorts later", () => {
  const other = "modules/notes/zzMongo.server.ts";
  const a = { path: FILE, source: src("'notes.mongo'") };
  const b = { path: other, source: src("'notes.mongo'") };
  for (const order of [
    [a, b],
    [b, a],
  ]) {
    const found = e1607(order);
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe(other);
  }
});
