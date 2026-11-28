// Seed 1337. Every branch of the std.postgres check rules over source text: which shapes fire, which do not, where each
// finding points and what it says, and that no rule throws (E1756) on a shape it does not look for.
import { check } from "@keel/check";
import { nodeDeployable } from "@keel/std-postgres/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
type Files = Parameters<typeof check>[0];
const module = (dir = "") => ({
  path: `${dir}modules/kitchen/module.ts`,
  source: `import { module } from "@keel/compiler"\nexport default module({ id: "kitchen", deps: ["@keel/std-postgres"] })\n`,
});
/** A topology whose first deployable holds the kitchen module, and the others too when `everywhere`. */
const topology = (dir: string, deployables: Record<string, string>, everywhere = false) => ({
  path: `${dir}topology.ts`,
  source: `import { topology } from "@keel/server"\nexport default topology({ ${Object.entries(deployables)
    .map(
      ([name, adapter], i) =>
        `"${name}": { modules: [${i === 0 || everywhere ? '"kitchen"' : ""}], adapter: "${adapter}" }`,
    )
    .join(", ")} })\n`,
});

/** The findings of `code` and any rule that threw, as `code path line:col message`. */
const found = (files: Files, code: string): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === code || d.code === "E1756")
    .map((d) => `${d.code} ${d.path} ${d.line}:${d.col} ${d.message}`);

/** 1-based line and column of the `nth` occurrence of `needle` in `source`. */
function at(source: string, needle: string, nth = 0): string {
  let i = -1;
  for (let k = 0; k <= nth; k++) i = source.indexOf(needle, i + 1);
  if (i < 0) throw new Error(`no ${needle} in source`);
  const before = source.slice(0, i).split("\n");
  return `${before.length}:${(before.at(-1) ?? "").length + 1}`;
}

const E2459 = "a transaction's allow has no reason written as a non-empty string literal";
const ALLOW_FILE = "modules/kitchen/kitchenRun.server.ts";
const allowSource = (opts: string) =>
  `// the run\nconst o = {}\nexport const run = (x: never, f: never, allow: never, reason: never, b: never) =>\n  x.transaction(f, ${opts})\n`;

test("E2459 fires on an allow with no literal non-blank reason, at the allow, and only there", () => {
  const fires: [string, string][] = [
    [`{ allow: "write skew" }`, "allow"],
    [`{ "allow": "write skew" }`, `"allow"`],
    [`{ allow: "write skew", reason: "" }`, "allow"],
    [`{ allow: "write skew", reason: "   " }`, "allow"],
    [`{ allow: "write skew", reason: \` \` }`, "allow"],
    [`{ allow: "write skew", reason: \`a\${b}\` }`, "allow"],
    [`{ allow: "write skew", reason }`, "allow:"],
    ["{ allow, reason }", "allow, reason }"],
    [`{ allow: "write skew", reason: 5 }`, "allow"],
    [`{ allow: "write skew", reason: b }`, "allow"],
    [`{ allow: "lost updates", ...o }`, "allow"],
  ];
  for (const [opts, needle] of fires) {
    const src = allowSource(opts);
    expect(found([{ path: ALLOW_FILE, source: src }], "E2459"), opts).toEqual([
      `E2459 ${ALLOW_FILE} ${at(src, needle, needle === "allow" || needle === "allow:" ? 1 : 0)} ${E2459}`,
    ]);
  }
  const quiet = [
    `{ allow: "write skew", reason: "audit rows only" }`,
    `{ reason: "audit rows only", allow: "write skew" }`,
    `{ allow: "write skew", "reason": "audit rows only" }`,
    `{ allow: "write skew", reason: \`audit rows only\` }`,
    `{ [allow]: "write skew" }`,
    `{ 1: "write skew" }`,
    "{ other: 1 }",
    "{ ...o }",
    "{}",
  ];
  for (const opts of quiet) expect(found([{ path: ALLOW_FILE, source: allowSource(opts) }], "E2459"), opts).toEqual([]);
});

test("E2459 reads only a .transaction( call by its plain name, and each object argument", () => {
  const calls = [
    `export const a = (x: never, f: never, transaction: never) => x.other(f, { allow: "write skew" })\n`,
    `export const a = (x: never, f: never, transaction: never) => x[transaction](f, { allow: "write skew" })\n`,
    `export const a = (x: never, f: never) => x["transaction"](f, { allow: "write skew" })\n`,
    `export const a = (x: never, f: never) => new x.transaction(f, { allow: "write skew" })\n`,
    `export const a = (transaction: never, f: never) => transaction(f, { allow: "write skew" })\n`,
    `export class A { #transaction(f: never, o: never) { return [f, o] } a(f: never) { return this.#transaction(f, { allow: "write skew" }) } }\n`,
  ];
  for (const source of calls) expect(found([{ path: ALLOW_FILE, source }], "E2459"), source).toEqual([]);
  const two = `export const a = (x: never) =>\n  x.transaction({ allow: "write skew" }, 1, { allow: "lost updates" })\n`;
  expect(found([{ path: ALLOW_FILE, source: two }], "E2459")).toEqual([
    `E2459 ${ALLOW_FILE} ${at(two, "allow")} ${E2459}`,
    `E2459 ${ALLOW_FILE} ${at(two, "allow", 1)} ${E2459}`,
  ]);
});

test("E2459's finding is on the allow's line and column wherever the call sits", () => {
  fc.assert(
    fc.property(fc.nat({ max: 6 }), fc.nat({ max: 12 }), (lines, indent) => {
      const src = `${"// pad\n".repeat(lines)}${" ".repeat(indent)}export const r = (x: never) => x.transaction(1, { allow: "write skew" })\n`;
      expect(found([{ path: ALLOW_FILE, source: src }], "E2459")).toEqual([
        `E2459 ${ALLOW_FILE} ${at(src, "allow")} ${E2459}`,
      ]);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

const E2451 = "@keel/std-postgres/server outside a *.server.ts file";
const PLAIN = "modules/kitchen/kitchenLoad.ts";

test("E2451 counts a dynamic import of the server entry by string or plain template, and an export-all of it", () => {
  const cases: [string, string[]][] = [
    ["export const m = () => import(`@keel/std-postgres/server`)\n", ["`@keel"]],
    ["export const m = (x: string) => import(`@keel/std-postgres/${x}`)\n", []],
    ['export const m = () => import("@keel/std-postgres")\n', []],
    ["export const m = (x: string) => import(x)\n", []],
    ['export * from "@keel/std-postgres/server"\n', ['"@keel']],
    ['export * as pg from "@keel/std-postgres/server"\n', ['"@keel']],
    ['export type * from "@keel/std-postgres/server"\n', []],
    ['export { x } from "./x.ts"\nexport * from "./y.ts"\n', []],
    [
      'const k = 1\nexport default k\nexport const m = async () => {\n  if (k) return import("@keel/std-postgres/server")\n}\n',
      ['"@keel'],
    ],
  ];
  for (const [source, needles] of cases)
    expect(found([module(), { path: PLAIN, source }], "E2451"), source).toEqual(
      needles.map((n) => `E2451 ${PLAIN} ${at(source, n)} ${E2451}`),
    );
});

const E2458 = "a database name is not a literal '<moduleId>.<name>' of its module";
const DB_FILE = "modules/kitchen/kitchenDb.server.ts";
const dbSource = (call: string, imports = 'import { database } from "@keel/std-postgres/server"') =>
  `${imports}\nconst name = "kitchen.db"\nexport const d = ${call}\n`;

test("E2458 fires on a database name that is not '<moduleId>.<lowerCamel>' as a literal, at the name or the call", () => {
  const fires: [string, string][] = [
    [`database("kitchen", {})`, `"kitchen"`],
    [`database("kitchen.db.more", {})`, `"kitchen.db.more"`],
    [`database("pantry.db", {})`, `"pantry.db"`],
    [`database("kitchen.Db", {})`, `"kitchen.Db"`],
    [`database("kitchen.", {})`, `"kitchen."`],
    ["database(name, {})", "name, {}"],
    ["database(5)", "5"],
    ["database()", "database()"],
  ];
  for (const [call, needle] of fires) {
    const src = dbSource(call);
    expect(found([module(), { path: DB_FILE, source: src }], "E2458"), call).toEqual([
      `E2458 ${DB_FILE} ${at(src, needle)} ${E2458}`,
    ]);
  }
  for (const call of [`database("kitchen.db", {})`, `database("kitchen.myDb2", {})`, `String("pantry")`])
    expect(found([module(), { path: DB_FILE, source: dbSource(call) }], "E2458"), call).toEqual([]);
});

test("E2458 reads the database import only: aliases and string names count, type imports and other names do not", () => {
  const cases: [string, string, boolean][] = [
    ['import { "database" as db } from "@keel/std-postgres/server"', 'db("bad")', true],
    ['import pg, { database as db } from "@keel/std-postgres/server"', 'db("bad")', true],
    [
      'import * as pg from "@keel/std-postgres/server"\nimport { database } from "@keel/std-postgres/server"',
      'database("bad")',
      true,
    ],
    ['import { database, migrate } from "@keel/std-postgres/server"', 'migrate("bad")', false],
    ['import { database } from "@keel/std-postgres/server"', 'new database("bad")', false],
    ['import { database } from "@keel/std-postgres/server"', 'pg.database("bad")', false],
    ['import type { database } from "@keel/std-postgres/server"', 'database("bad")', false],
    ['import { type database } from "@keel/std-postgres/server"', 'database("bad")', false],
    ['import { database } from "@keel/std-postgres"', 'database("bad")', false],
  ];
  for (const [imports, call, fires] of cases) {
    const src = dbSource(call, imports);
    expect(found([module(), { path: DB_FILE, source: src }], "E2458"), imports).toEqual(
      fires ? [`E2458 ${DB_FILE} ${at(src, '"bad"')} ${E2458}`] : [],
    );
  }
  const outside = "lib/kitchenDb.server.ts";
  const src = dbSource(`database("kitchen.db", {})`);
  expect(found([{ path: outside, source: src }], "E2458")).toEqual([
    `E2458 ${outside} ${at(src, '"kitchen.db", {}')} ${E2458}`,
  ]);
});

const W2456 = "a clock or random call in SQL text is not replayed under sim";
const Q_FILE = "modules/kitchen/kitchenQ.server.ts";

test("W2456 reads sql(...) and fragment tags as imported, and no other tag", () => {
  const S = 'import { s } from "@keel/schema"\nconst S = s.object({})\n';
  const cases: [string, string[]][] = [
    ['import { fragment } from "@keel/std-postgres"\nexport const f = fragment`select now()`\n', ["now()"]],
    [
      'import { sql } from "@keel/std-postgres"\nconst foo = (x: never) => String.raw\nexport const q = foo(S)`select now()`\n',
      [],
    ],
    ['import { sql as q, fragment as f } from "@keel/std-postgres"\nexport const a = f(S)`select now()`\n', []],
    [
      'import { sql as q, fragment as f } from "@keel/std-postgres"\nexport const a = q(S)`select\n  random()`\n',
      ["random()"],
    ],
    ['import type { sql } from "@keel/std-postgres"\nexport const a = sql(S)`select now()`\n', []],
    ['import { sql } from "@keel/std-postgres"\nexport const a = sql.x(S)`select now()`\n', []],
    ['import { sql } from "@keel/std-postgres"\nexport const a = String.raw`select now()`\n', []],
  ];
  for (const [body, needles] of cases) {
    const source = S + body;
    expect(found([module(), { path: Q_FILE, source }], "W2456"), body).toEqual(
      needles.map((n) => `W2456 ${Q_FILE} ${at(source, n)} ${W2456}`),
    );
  }
});

test("W2456 in a migration skips -- comments and points at each call where the file has it", () => {
  const path = "modules/kitchen/migrations/0001-init.sql";
  const cases: [string, [string, number][]][] = [
    ["-- now() is not used\ncreate table t (at timestamptz default now())\n", [["now()", 1]]],
    ["select 1 -- random()\n;select random() -- now()", [["random()", 1]]],
    [
      "-- a\n-- bb now()\n--\nselect gen_random_uuid(), now()",
      [
        ["gen_random_uuid()", 0],
        ["now()", 1],
      ],
    ],
    ["-- only now() in comments", []],
  ];
  for (const [source, needles] of cases)
    expect(found([module(), { path, source }], "W2456"), source).toEqual(
      needles.map(([n, nth]) => `W2456 ${path} ${at(source, n, nth)} ${W2456}`),
    );
});

test("E2452 names the deployable (24 characters at most) and its adapter, in a project under a folder too", () => {
  const dir = "apps/shop/";
  const path = `${dir}modules/kitchen/kitchenDb.server.ts`;
  const source = 'import { database } from "@keel/std-postgres/server"\nexport const d = database\n';
  const files = [
    module(dir),
    { path, source },
    topology(dir, { "a-deployable-named-past-twenty-four": "static", api: "node" }),
  ];
  expect(found(files, "E2452")).toEqual([
    `E2452 ${path} 1:26 a database needs a node deployable; 'a-deployable-named-past-' is static`,
  ]);
  const both = [module(dir), { path, source }, topology(dir, { web: "client", site: "static" }, true)];
  expect(found(both, "E2452")).toEqual([
    `E2452 ${path} 1:26 a database needs a node deployable; 'site' is static`,
    `E2452 ${path} 1:26 a database needs a node deployable; 'web' is client`,
  ]);
  expect(found([module(dir), { path, source }, topology(dir, { api: "node" })], "E2452")).toEqual([]);
  expect(found([module(dir), { path, source }], "E2452")).toEqual([]);
  expect(found([module(dir), { path, source }, topology("", { web: "static" })], "E2452")).toEqual([]);
  expect(found([{ path: "lib/db.ts", source }, topology("", { web: "static" })], "E2452")).toEqual([]);
  const none = [
    module(),
    { path: "modules/kitchen/plain.ts", source: "export const k = 1\n" },
    topology("", { web: "static" }),
  ];
  expect(found(none, "E2452")).toEqual([]);
});

test("E2452's message reads a finding with no data without throwing", () => {
  const message = nodeDeployable.message;
  expect(typeof message === "function" ? message({ path: "a.ts", line: 1, col: 1 }) : message).toBe(
    "a database needs a node deployable; 'undefined' is undefined",
  );
});

test("E2460 is checked at run time: no file gets a finding from it", () => {
  const source = 'import { database } from "@keel/std-postgres/server"\nexport const d = (t: never) => t\n';
  expect(found([module(), { path: DB_FILE, source }], "E2460")).toEqual([]);
});
