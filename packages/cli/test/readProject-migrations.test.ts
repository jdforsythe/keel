import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { readProject } from "../src/internal/readProject.ts";

let root = "";
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "keel-sql-")));
  put("apps/a/modules/kitchen/migrations/0001-init.sql", "create table t (id int)");
  put("modules/kitchen/migrations/0001-init.sql", "create table u (id int)");
  put("modules/kitchen/seed.sql", "insert into t values (1)");
  put("modules/kitchen/kitchen.ts", "export const kitchen = 1;\n");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("check's read holds each module's migrations with their text and no other .sql", () => {
  const sql = readProject(root, "query").filter((f) => f.path.endsWith(".sql"));
  expect(sql).toEqual([
    { path: "apps/a/modules/kitchen/migrations/0001-init.sql", source: "create table t (id int)" },
    { path: "modules/kitchen/migrations/0001-init.sql", source: "create table u (id int)" },
  ]);
});
