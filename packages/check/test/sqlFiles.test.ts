import { type SourceFile, check, defineRule } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const seenSql: string[] = [];
const seenCode: string[] = [];
defineRule({
  code: "W2925",
  message: "sql probe",
  see: "k.check",
  explain: "Reports each `select` in a SQL file and records the files each reader receives.",
  check: ({ file }) => {
    seenCode.push(file.path);
    return [];
  },
  sql: (file) => {
    seenSql.push(file.path);
    return [...file.source.matchAll(/select/g)].map((m) => ({ path: file.path, line: 1, col: m.index + 1 }));
  },
});
defineRule({
  code: "W2926",
  message: "sql reader that throws",
  see: "k.check",
  explain: "Throws on a SQL file whose text holds `boom`.",
  check: () => [],
  sql: (file) => {
    if (file.source.includes("boom")) throw new Error("boom");
    return [];
  },
});

const MIGRATION = "modules/kitchen/migrations/0001-init.sql";
const run = (files: readonly SourceFile[]) => {
  seenSql.length = 0;
  seenCode.length = 0;
  return check(files, { types: false }).diagnostics;
};

test("a migration reaches each rule's sql reader, once, with its path and text, and no code rule", () => {
  const ds = run([
    { path: "modules/kitchen/a.ts", source: "export const a = 1;\n" },
    { path: MIGRATION, source: "select 1; select 2;" },
  ]);
  expect(seenSql).toEqual([MIGRATION]);
  expect(seenCode).toEqual(["modules/kitchen/a.ts"]);
  expect(ds.filter((d) => d.code === "W2925").map((d) => [d.path, d.col])).toEqual([
    [MIGRATION, 1],
    [MIGRATION, 11],
  ]);
  expect(ds.every((d) => d.path !== MIGRATION || d.code === "W2925")).toBe(true);
});

test("a migration at any depth is read; a .sql elsewhere is not", () => {
  run([
    { path: "apps/x/modules/m/migrations/0002-more.sql", source: "select 1" },
    { path: "modules/m/seed.sql", source: "select 1" },
    { path: "migrations/0001-x.sql", source: "select 1" },
    { path: "modules/m/migrations/nested/0001-x.sql", source: "select 1" },
  ]);
  expect(seenSql).toEqual(["apps/x/modules/m/migrations/0002-more.sql"]);
});

test("a sql reader that throws is one E1756 on its file and the other readers still report", () => {
  const ds = run([{ path: MIGRATION, source: "select boom" }]);
  expect(ds.filter((d) => d.code === "E1756").map((d) => [d.path, d.message])).toEqual([
    [MIGRATION, "rule W2926 threw: boom"],
  ]);
  expect(ds.filter((d) => d.code === "W2925")).toHaveLength(1);
});

test("SQL text never reaches the parser: any migration text yields no diagnostic but the readers'", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 80 }), (text) => {
      const ds = run([{ path: MIGRATION, source: text.replaceAll("boom", "") }]);
      expect(ds.filter((d) => d.code !== "W2925")).toEqual([]);
      expect(seenCode).toEqual([]);
    }),
    { seed: SEED, numRuns: 50 },
  );
});
