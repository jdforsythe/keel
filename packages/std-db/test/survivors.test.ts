// The internal helpers, the E2151 rule's positions, and each driver's failure and close paths: the Postgres driver over
// a recording pool, the SQLite driver over files in a temporary directory.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { check } from "@keel/check";
import "@keel/std-db/tools";
import type { PgClient } from "@keel/std-db/postgres";
import type { PgPool } from "@keel/std-db/postgres";
import { postgres } from "@keel/std-db/postgres";
import { sqlite } from "@keel/std-db/sqlite";
import { afterEach, describe, expect, test } from "vitest";
import { checkLayout } from "../src/internal/checkLayout.ts";
import { dbError } from "../src/internal/dbError.ts";
import { distinctKeys } from "../src/internal/distinctKeys.ts";
import { opFailed } from "../src/internal/opFailed.ts";
import { removeDir, tempDir } from "./support.ts";

/** The rejection of `p`; fails when `p` resolves. */
async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("the promise resolved");
}
const messageOf = (e: unknown): string => (e instanceof Error ? e.message : `not an Error: ${String(e)}`);
const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined);

describe("opFailed", () => {
  test("names the driver, the operation and the database's own error code", () => {
    expect(opFailed("postgres", "commit", { code: "57P01" }).message).toBe("std.db postgres: commit failed (57P01)");
    expect(opFailed("sqlite", "read", { errcode: 5 }).message).toBe("std.db sqlite: read failed (sqlite 5)");
    expect(
      opFailed("sqlite", "set", Object.assign(new Error("x"), { code: "ERR_SQLITE_ERROR", errcode: 19 })).message,
    ).toBe("std.db sqlite: set failed (sqlite 19)");
  });

  test("a code that is not a string and an errcode that is not a number are unknown", () => {
    expect(opFailed("postgres", "set", { code: 7 }).message).toBe("std.db postgres: set failed (unknown)");
    expect(opFailed("sqlite", "get", { errcode: "5" }).message).toBe("std.db sqlite: get failed (unknown)");
    expect(opFailed("sqlite", "get", { errcode: "5", code: "C" }).message).toBe("std.db sqlite: get failed (C)");
    expect(opFailed("postgres", "read", {}).message).toBe("std.db postgres: read failed (unknown)");
    expect(opFailed("postgres", "read", new Error("secret")).message).toBe("std.db postgres: read failed (unknown)");
  });

  test("a thrown value that is not an object is unknown", () => {
    for (const e of [null, undefined, "code", "errcode", 5, true])
      expect(opFailed("postgres", "read", e).message).toBe("std.db postgres: read failed (unknown)");
    const fn = Object.assign(() => undefined, { code: "F", errcode: 3 });
    expect(opFailed("postgres", "read", fn).message).toBe("std.db postgres: read failed (unknown)");
  });
});

describe("checkLayout", () => {
  test("no row asks for one; the package's layout does not", () => {
    expect(checkLayout(undefined)).toBe(true);
    expect(checkLayout(null)).toBe(true);
    expect(checkLayout("1")).toBe(false);
  });

  test("a newer layout is E2152 naming both versions", () => {
    for (const [stored, n] of [
      ["2", 2],
      ["10", 10],
      ["123456789", 123456789],
    ] as const) {
      let thrown: unknown;
      try {
        checkLayout(stored);
      } catch (e) {
        thrown = e;
      }
      expect(codeOf(thrown)).toBe("E2152");
      expect(messageOf(thrown)).toBe(`E2152 database layout ${n} is newer than this std.db's 1; upgrade @keel/std-db`);
    }
  });

  test("a row that is not a whole number from 1 is E2153", () => {
    for (const stored of ["0", "", "abc", "01", "x2", "2x", "2 ", " 2", "1.5", "-1", "1234567890", 2, 1, true, {}]) {
      let thrown: unknown;
      try {
        checkLayout(stored);
      } catch (e) {
        thrown = e;
      }
      expect(codeOf(thrown)).toBe("E2153");
      expect(messageOf(thrown)).toBe(
        "E2153 KEEL_DATABASE_URL names a database whose keel_meta layout is not a version",
      );
    }
  });
});

describe("dbError and distinctKeys", () => {
  test("dbError's message starts with the code, and code is readable but not enumerable", () => {
    const e = dbError("E2153", "text");
    expect(e.message).toBe("E2153 text");
    expect(e.code).toBe("E2153");
    expect(Object.keys(e)).toEqual([]);
    expect(Object.getOwnPropertyDescriptor(e, "code")?.enumerable).toBe(false);
  });

  test("distinctKeys sorts, and finds a key named twice wherever the two sit", () => {
    expect(distinctKeys([{ key: "c" }, { key: "a" }, { key: "b" }])).toEqual(["a", "b", "c"]);
    expect(distinctKeys([])).toEqual([]);
    let thrown: unknown;
    try {
      distinctKeys([{ key: "a" }, { key: "b" }, { key: "a" }]);
    } catch (e) {
      thrown = e;
    }
    expect(codeOf(thrown)).toBe("E1606");
    expect(messageOf(thrown)).toBe("E1606 commit names one key twice");
  });
});

describe("E2151", () => {
  type Files = Parameters<typeof check>[0];
  const manifest = `import { module } from "@keel/compiler"\nexport default module({ id: "orders", capabilities: ["storage"] })\n`;
  const topo = `import { topology } from "@keel/server"\nexport default topology({ web: { modules: ["orders"], adapter: "node", storage: "sqlite" } })\n`;
  const HOME = "modules/orders/db.server.ts";
  const found = (source: string) => {
    const files: Files = [
      { path: "modules/orders/module.ts", source: manifest },
      { path: HOME, source },
      { path: "topology.ts", source: topo },
    ];
    return check(files, { types: false })
      .diagnostics.filter((d) => d.code === "E2151")
      .map((d) => ({ path: d.path, line: d.line, col: d.col }));
  };

  test("sits at the specifier of each import and re-export, by 1-based line and column", () => {
    const source = [
      `import { ok } from "@keel/schema"`,
      "const local = 1",
      "export const x = ok(local)",
      `  import { sqlite } from "@keel/std-db/sqlite"`,
      `export * from "@keel/std-db/postgres"`,
      `export { importsDb } from "@keel/std-db/tools"`,
      `export { ok } from "@keel/schema"`,
      `export * from "@keel/std-dbx"`,
      "export { local, sqlite }",
      "",
    ].join("\n");
    expect(found(source)).toEqual([
      { path: HOME, line: 4, col: 26 },
      { path: HOME, line: 5, col: 15 },
      { path: HOME, line: 6, col: 27 },
    ]);
  });

  test("an import on the first line is at line 1", () => {
    expect(found(`import "@keel/std-db"\n`)).toEqual([{ path: HOME, line: 1, col: 8 }]);
  });
});

type Call = { readonly on: "pool" | "client"; readonly text: string; readonly values?: readonly unknown[] };
type Fake = {
  readonly pool: PgPool;
  readonly calls: Call[];
  readonly released: (boolean | undefined)[];
  ended: number;
  /** What a statement resolves, or throws: called for every statement; `undefined` resolves no rows. */
  answer: (call: Call) => readonly unknown[] | undefined;
};

/** A pool that records each statement, the argument of each `release` and the count of `end` calls. */
function fakePool(): Fake {
  const fake: Fake = {
    calls: [],
    released: [],
    ended: 0,
    answer: () => undefined,
    pool: {
      query: async (text, values) => run("pool", text, values),
      connect: async (): Promise<PgClient> => ({
        query: async (text, values) => run("client", text, values),
        release: (destroy) => {
          fake.released.push(destroy);
        },
      }),
      end: async () => {
        fake.ended++;
      },
    },
  };
  const run = (on: Call["on"], text: string, values: readonly unknown[] | undefined) => {
    const call: Call = values === undefined ? { on, text } : { on, text, values };
    fake.calls.push(call);
    return { rows: fake.answer(call) ?? [] };
  };
  return fake;
}

const PG_URL = new URL("postgres://keel:secret@localhost:5432/keel");
const LAYOUT_SELECT = "select value from keel_meta where name = 'layout'";
const SELECT = "select key, value from keel_kv where key = any($1::text[])";
const LOCK =
  "select pg_advisory_xact_lock(hashtextextended(k, 0)) from unnest($1::text[]) with ordinality as t(k, i) order by i";
const UPSERT =
  "insert into keel_kv (key, value) select * from unnest($1::text[], $2::text[]) on conflict (key) do update set value = excluded.value";
const BEGIN = "begin isolation level read committed";

/** An opened driver over a fake pool whose database is at the package's layout, its open statements forgotten. */
async function openFake(): Promise<{ fake: Fake; storage: Awaited<ReturnType<typeof postgres>> }> {
  const fake = fakePool();
  fake.answer = (c) => (c.text === LAYOUT_SELECT ? [{ value: "1" }] : undefined);
  const storage = await postgres(PG_URL, { clientFactory: () => fake.pool });
  fake.calls.length = 0;
  fake.released.length = 0;
  fake.answer = () => undefined;
  return { fake, storage };
}
const texts = (fake: Fake): string[] => fake.calls.map((c) => c.text);

describe("postgres driver over a recording pool", () => {
  test("a URL of another scheme rejects E2153 and asks for no pool", async () => {
    let asked = 0;
    const fake = fakePool();
    const factory = () => {
      asked++;
      return fake.pool;
    };
    for (const href of ["mysql://h/db", "file:///tmp/x", "postgres+x://h/db", "http://h/db"]) {
      const e = await rejection(postgres(new URL(href), { clientFactory: factory }));
      expect(codeOf(e)).toBe("E2153");
      expect(messageOf(e)).toBe("E2153 KEEL_DATABASE_URL is not a postgres: or postgresql: URL");
    }
    expect(asked).toBe(0);
  });

  test("opening an empty database is one read committed transaction on one client that writes the layout row", async () => {
    for (const href of ["postgres://h/db", "postgresql://h/db"]) {
      const fake = fakePool();
      const storage = await postgres(new URL(href), { clientFactory: () => fake.pool });
      expect(fake.calls).toEqual([
        { on: "client", text: BEGIN },
        { on: "client", text: "select pg_advisory_xact_lock(7265657)" },
        { on: "client", text: "create table if not exists keel_kv (key text primary key, value text not null)" },
        { on: "client", text: "create table if not exists keel_meta (name text primary key, value text not null)" },
        { on: "client", text: LAYOUT_SELECT },
        { on: "client", text: "insert into keel_meta (name, value) values ('layout', $1)", values: ["1"] },
        { on: "client", text: "commit" },
      ]);
      expect(fake.released).toEqual([false]);
      expect(fake.ended).toBe(0);
      await storage.close();
    }
  });

  test("opening a database at the package's layout writes no layout row", async () => {
    const fake = fakePool();
    fake.answer = (c) => (c.text === LAYOUT_SELECT ? [{ value: "1" }] : undefined);
    await postgres(PG_URL, { clientFactory: () => fake.pool });
    expect(texts(fake).filter((t) => t.startsWith("insert"))).toEqual([]);
    expect(texts(fake).at(-1)).toBe("commit");
  });

  test("a newer layout rejects E2152 and a layout that is no version E2153, each after a rollback and ending the pool", async () => {
    for (const [value, code, message] of [
      ["2", "E2152", "E2152 database layout 2 is newer than this std.db's 1; upgrade @keel/std-db"],
      ["zero", "E2153", "E2153 KEEL_DATABASE_URL names a database whose keel_meta layout is not a version"],
    ] as const) {
      const fake = fakePool();
      fake.answer = (c) => (c.text === LAYOUT_SELECT ? [{ value }] : undefined);
      const e = await rejection(postgres(PG_URL, { clientFactory: () => fake.pool }));
      expect(codeOf(e)).toBe(code);
      expect(messageOf(e)).toBe(message);
      expect(texts(fake).at(-1)).toBe("rollback");
      expect(fake.released).toEqual([false]);
      expect(fake.ended).toBe(1);
    }
  });

  test("a layout row that is not an object with a value is read as no row", async () => {
    for (const row of [null, "1", 7, {}]) {
      const fake = fakePool();
      fake.answer = (c) => (c.text === LAYOUT_SELECT ? [row] : undefined);
      await postgres(PG_URL, { clientFactory: () => fake.pool });
      expect(texts(fake).filter((t) => t.startsWith("insert")).length).toBe(1);
    }
  });

  test("any other failure while opening rejects one E2153 that names no part of the failure, and ends the pool", async () => {
    const failures: unknown[] = [
      Object.assign(new Error("password authentication failed for user keel"), { code: "28P01" }),
      new Error("connect ECONNREFUSED 127.0.0.1:5432"),
      { code: "E2152" },
      { code: "E2153" },
      "refused",
      null,
    ];
    for (const failure of failures) {
      const fake = fakePool();
      fake.answer = (c) => {
        if (c.text.startsWith("create table")) throw failure;
        return undefined;
      };
      const e = await rejection(postgres(PG_URL, { clientFactory: () => fake.pool }));
      expect(e).toBeInstanceOf(Error);
      expect(codeOf(e)).toBe("E2153");
      expect(messageOf(e)).toBe("E2153 KEEL_DATABASE_URL: the Postgres database cannot be reached or set up");
      expect(fake.ended).toBe(1);
    }
  });

  test("a pool whose end() rejects while opening fails still rejects E2153", async () => {
    const fake = fakePool();
    fake.answer = () => {
      throw new Error("down");
    };
    const pool: PgPool = { ...fake.pool, end: async () => Promise.reject(new Error("end failed")) };
    const e = await rejection(postgres(PG_URL, { clientFactory: () => pool }));
    expect(messageOf(e)).toBe("E2153 KEEL_DATABASE_URL: the Postgres database cannot be reached or set up");
  });

  test("commit locks the sorted keys, compares, upserts the writes that carry a value, and commits", async () => {
    const { fake, storage } = await openFake();
    fake.answer = (c) => (c.text === SELECT ? [{ key: "a", value: "old" }] : undefined);
    const ok = await storage.commit([
      { key: "b", expect: null, value: "B" },
      { key: "a", expect: "old", value: "A" },
      { key: "c", expect: null },
    ]);
    expect(ok).toBe(true);
    expect(fake.calls).toEqual([
      { on: "client", text: BEGIN },
      { on: "client", text: LOCK, values: [["a", "b", "c"]] },
      { on: "client", text: SELECT, values: [["a", "b", "c"]] },
      {
        on: "client",
        text: UPSERT,
        values: [
          ["b", "a"],
          ["B", "A"],
        ],
      },
      { on: "client", text: "commit" },
    ]);
    expect(fake.released).toEqual([false]);
  });

  test("a commit whose writes carry no value upserts nothing", async () => {
    const { fake, storage } = await openFake();
    expect(await storage.commit([{ key: "a", expect: null }])).toBe(true);
    expect(texts(fake)).toEqual([BEGIN, LOCK, SELECT, "commit"]);
  });

  test("a commit whose expectation fails rolls back, writes nothing and keeps the client", async () => {
    const { fake, storage } = await openFake();
    fake.answer = (c) => (c.text === SELECT ? [{ key: "a", value: "other" }] : undefined);
    expect(await storage.commit([{ key: "a", expect: "old", value: "A" }])).toBe(false);
    expect(texts(fake)).toEqual([BEGIN, LOCK, SELECT, "rollback"]);
    expect(fake.released).toEqual([false]);
  });

  test("set locks and upserts without comparing", async () => {
    const { fake, storage } = await openFake();
    await storage.set("k", "v");
    expect(fake.calls).toEqual([
      { on: "client", text: BEGIN },
      { on: "client", text: LOCK, values: [["k"]] },
      { on: "client", text: UPSERT, values: [["k"], ["v"]] },
      { on: "client", text: "commit" },
    ]);
  });

  test("read and get are one SELECT on the pool; a row whose key or value is not a string is no value", async () => {
    const { fake, storage } = await openFake();
    fake.answer = () => [
      { key: "a", value: "A" },
      { key: "b", value: 5 },
      { key: 6, value: "six" },
      { key: "c" },
      { value: "d" },
      null,
    ];
    expect(await storage.read(["a", "b", "c", "d", "a"])).toEqual(["A", null, null, null, "A"]);
    expect(await storage.get("a")).toBe("A");
    expect(await storage.get("b")).toBeNull();
    expect(fake.calls).toEqual([
      { on: "pool", text: SELECT, values: [["a", "b", "c", "d", "a"]] },
      { on: "pool", text: SELECT, values: [["a"]] },
      { on: "pool", text: SELECT, values: [["b"]] },
    ]);
    expect(await storage.commit([{ key: "b", expect: null }])).toBe(true);
  });

  test("a statement that fails rolls back, keeps the client, and rejects naming the operation and the server's code", async () => {
    const { fake, storage } = await openFake();
    fake.answer = (c) => {
      if (c.text === LOCK || c.text === SELECT) throw Object.assign(new Error("secret detail"), { code: "57P01" });
      return undefined;
    };
    expect(messageOf(await rejection(storage.commit([{ key: "a", expect: null, value: "v" }])))).toBe(
      "std.db postgres: commit failed (57P01)",
    );
    expect(messageOf(await rejection(storage.set("a", "v")))).toBe("std.db postgres: set failed (57P01)");
    expect(messageOf(await rejection(storage.read(["a"])))).toBe("std.db postgres: read failed (57P01)");
    expect(messageOf(await rejection(storage.get("a")))).toBe("std.db postgres: read failed (57P01)");
    expect(texts(fake)).toEqual([BEGIN, LOCK, "rollback", BEGIN, LOCK, "rollback", SELECT, SELECT]);
    expect(fake.released).toEqual([false, false]);
  });

  test("a failed rollback drops the client", async () => {
    const { fake, storage } = await openFake();
    fake.answer = (c) => {
      if (c.text === LOCK || c.text === "rollback") throw Object.assign(new Error("gone"), { code: "08006" });
      return undefined;
    };
    expect(messageOf(await rejection(storage.set("a", "v")))).toBe("std.db postgres: set failed (08006)");
    expect(fake.released).toEqual([true]);
  });

  test("close ends the pool once, and every call after it rejects naming the operation, sending nothing", async () => {
    const { fake, storage } = await openFake();
    expect(fake.ended).toBe(0);
    await storage.close();
    expect(fake.ended).toBe(1);
    await storage.close();
    expect(fake.ended).toBe(1);
    expect(messageOf(await rejection(storage.commit([{ key: "a", expect: null, value: "v" }])))).toBe(
      "std.db postgres: commit after close()",
    );
    expect(messageOf(await rejection(storage.set("a", "v")))).toBe("std.db postgres: set after close()");
    expect(messageOf(await rejection(storage.read(["a"])))).toBe("std.db postgres: read after close()");
    expect(messageOf(await rejection(storage.get("a")))).toBe("std.db postgres: read after close()");
    expect(fake.calls).toEqual([]);
  });

  test("a key named twice and a key holding U+0000 reject before any statement", async () => {
    const { fake, storage } = await openFake();
    const twice = await rejection(
      storage.commit([
        { key: "a", expect: null },
        { key: "a", expect: null },
      ]),
    );
    expect(codeOf(twice)).toBe("E1606");
    expect(messageOf(await rejection(storage.get("a\u0000")))).toBe(
      "std.db: a key or value holds U+0000 or a lone surrogate",
    );
    expect(fake.calls).toEqual([]);
  });
});

describe("sqlite driver on a file", () => {
  const dirs: string[] = [];
  const closers: { close(): Promise<void> }[] = [];
  afterEach(async () => {
    for (const s of closers.splice(0)) await s.close();
    for (const d of dirs.splice(0)) removeDir(d);
  });
  const newFile = (): string => {
    const dir = tempDir();
    dirs.push(dir);
    return join(dir, "keel.sqlite");
  };
  const open = async (file: string) => {
    const s = await sqlite(pathToFileURL(file));
    closers.push(s);
    return s;
  };
  /** Runs `sql` on a second connection to `file`. */
  const exec = (file: string, sql: string): void => {
    const db = new DatabaseSync(file);
    try {
      db.exec(sql);
    } finally {
      db.close();
    }
  };

  test("a file in a folder that does not exist rejects E2153 naming the URL setting", async () => {
    const e = await rejection(sqlite(pathToFileURL(join(newFile(), "no", "such", "keel.sqlite"))));
    expect(codeOf(e)).toBe("E2153");
    expect(messageOf(e)).toBe(
      "E2153 KEEL_DATABASE_URL: SQLite cannot open the file; check the file: URL and that its folder exists",
    );
  });

  test("a file that is not a database rejects E2153 and leaves the file free", async () => {
    const file = newFile();
    writeFileSync(file, "this is not a sqlite database, only some text long enough to be read as a header".repeat(40));
    const e = await rejection(sqlite(pathToFileURL(file)));
    expect(e).toBeInstanceOf(Error);
    expect(codeOf(e)).toBe("E2153");
    expect(messageOf(e)).toBe("E2153 KEEL_DATABASE_URL: SQLite cannot open or set up the database");
  });

  test("a folder in place of the file rejects E2153", async () => {
    const file = newFile();
    mkdirSync(file);
    expect(codeOf(await rejection(sqlite(pathToFileURL(file))))).toBe("E2153");
  });

  test("a newer layout rejects E2152 and a layout that is no version E2153, and neither holds a lock on the file", async () => {
    for (const [value, code, message] of [
      ["2", "E2152", "E2152 database layout 2 is newer than this std.db's 1; upgrade @keel/std-db"],
      ["zero", "E2153", "E2153 KEEL_DATABASE_URL names a database whose keel_meta layout is not a version"],
    ] as const) {
      const file = newFile();
      exec(
        file,
        `create table keel_meta (name text primary key, value text not null); insert into keel_meta values ('layout', '${value}')`,
      );
      const e = await rejection(sqlite(pathToFileURL(file)));
      expect(codeOf(e)).toBe(code);
      expect(messageOf(e)).toBe(message);
      exec(file, "begin exclusive; update keel_meta set value = '1'; commit");
      const s = await open(file);
      expect(await s.get("a")).toBeNull();
    }
  });

  test("opening leaves the file in WAL mode with the layout row", async () => {
    const file = newFile();
    await open(file);
    const db = new DatabaseSync(file);
    try {
      expect(db.prepare("pragma journal_mode").get()).toEqual({ journal_mode: "wal" });
      expect(db.prepare("select value from keel_meta where name = 'layout'").get()).toEqual({ value: "1" });
    } finally {
      db.close();
    }
  });

  test("close may be called twice, and every call after it rejects naming the operation", async () => {
    const s = await sqlite(pathToFileURL(newFile()));
    await s.set("a", "v");
    await s.close();
    await s.close();
    expect(messageOf(await rejection(s.get("a")))).toBe("std.db sqlite: get after close()");
    expect(messageOf(await rejection(s.set("a", "v")))).toBe("std.db sqlite: set after close()");
    expect(messageOf(await rejection(s.read(["a"])))).toBe("std.db sqlite: read after close()");
    expect(messageOf(await rejection(s.commit([{ key: "a", expect: "v", value: "w" }])))).toBe(
      "std.db sqlite: commit after close()",
    );
  });

  test("get rejects a key holding U+0000 or a lone surrogate", async () => {
    const s = await open(newFile());
    for (const bad of ["a\u0000b", "x\ud800", "\udc00y"])
      expect(messageOf(await rejection(s.get(bad)))).toBe("std.db: a key or value holds U+0000 or a lone surrogate");
  });

  test("a statement SQLite refuses rejects naming the operation and SQLite's code", async () => {
    const file = newFile();
    const s = await open(file);
    exec(file, "drop table keel_kv");
    expect(messageOf(await rejection(s.get("a")))).toBe("std.db sqlite: get failed (sqlite 1)");
    expect(messageOf(await rejection(s.set("a", "v")))).toBe("std.db sqlite: set failed (sqlite 1)");
    expect(messageOf(await rejection(s.read(["a"])))).toBe("std.db sqlite: read failed (sqlite 1)");
    expect(messageOf(await rejection(s.commit([{ key: "a", expect: null, value: "v" }])))).toBe(
      "std.db sqlite: commit failed (sqlite 1)",
    );
    exec(file, "create table keel_kv (key text primary key, value text not null)");
    expect(await s.commit([{ key: "a", expect: null, value: "v" }])).toBe(true);
    expect(await s.get("a")).toBe("v");
  });

  for (const action of ["abort", "rollback"] as const) {
    test(`a write that fails mid-commit (${action}) stores none of the commit, and the next commit runs`, async () => {
      const file = newFile();
      const s = await open(file);
      exec(
        file,
        `create trigger keel_test_refuse before insert on keel_kv when new.key = 'boom' begin select raise(${action}, 'refused'); end`,
      );
      const e = await rejection(
        s.commit([
          { key: "a", expect: null, value: "A" },
          { key: "boom", expect: null, value: "B" },
        ]),
      );
      expect(messageOf(e)).toMatch(/^std\.db sqlite: commit failed \(sqlite (19|1811)\)$/);
      expect(await s.read(["a", "boom"])).toEqual([null, null]);
      expect(await s.commit([{ key: "a", expect: null, value: "A2" }])).toBe(true);
      expect(await s.get("a")).toBe("A2");
    });
  }

  test("a commit whose expectation fails leaves no transaction open", async () => {
    const file = newFile();
    const s = await open(file);
    expect(await s.commit([{ key: "a", expect: "x", value: "A" }])).toBe(false);
    exec(file, "begin exclusive; commit");
    expect(await s.commit([{ key: "a", expect: null, value: "A" }])).toBe(true);
  });
});
