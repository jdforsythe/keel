// The statements the SQLite driver sends and whether it closes a database it could not set up, seen through a
// `DatabaseSync` that records them.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sqlite } from "@keel/std-db/sqlite";
import { afterEach, expect, test, vi } from "vitest";
import { removeDir, tempDir } from "./support.server.ts";

const seen = vi.hoisted(() => {
  const state: { executed: string[]; closed: number; refuse: string } = { executed: [], closed: 0, refuse: "" };
  return state;
});

vi.mock("node:sqlite", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:sqlite")>();
  class DatabaseSync extends real.DatabaseSync {
    override exec(sql: string): void {
      seen.executed.push(sql);
      if (seen.refuse !== "" && sql === seen.refuse) throw new Error("refused");
      super.exec(sql);
    }
    override close(): void {
      seen.closed++;
      super.close();
    }
  }
  return { ...real, DatabaseSync };
});

const dirs: string[] = [];
afterEach(() => {
  seen.refuse = "";
  for (const d of dirs.splice(0)) removeDir(d);
});
const newUrl = (): URL => {
  const dir = tempDir();
  dirs.push(dir);
  seen.executed = [];
  seen.closed = 0;
  return pathToFileURL(join(dir, "keel.sqlite"));
};

test("opening sets the busy timeout, WAL, full sync and secure delete, then creates the tables in one transaction", async () => {
  const s = await sqlite(newUrl());
  expect(seen.executed).toEqual([
    "pragma busy_timeout = 5000",
    "pragma journal_mode = wal",
    "pragma synchronous = full",
    "pragma secure_delete = on",
    "begin immediate",
    "create table if not exists keel_kv (key text primary key, value text not null)",
    "create table if not exists keel_meta (name text primary key, value text not null)",
    "commit",
  ]);
  await s.close();
  expect(seen.closed).toBe(1);
});

test("a commit is BEGIN IMMEDIATE then COMMIT, or ROLLBACK when an expectation fails", async () => {
  const s = await sqlite(newUrl());
  seen.executed = [];
  expect(await s.commit([{ key: "a", expect: null, value: "A" }])).toBe(true);
  expect(seen.executed).toEqual(["begin immediate", "commit"]);
  seen.executed = [];
  expect(await s.commit([{ key: "a", expect: null, value: "B" }])).toBe(false);
  expect(seen.executed).toEqual(["begin immediate", "rollback"]);
  expect(await s.get("a")).toBe("A");
  await s.close();
});

test("a database that cannot be set up is closed, rolled back when a transaction is open, and rejects E2153", async () => {
  for (const [refuse, last] of [
    ["pragma synchronous = full", "pragma synchronous = full"],
    ["create table if not exists keel_meta (name text primary key, value text not null)", "rollback"],
  ] as const) {
    const url = newUrl();
    seen.refuse = refuse;
    let thrown: unknown;
    try {
      await sqlite(url);
    } catch (e) {
      thrown = e;
    }
    expect(thrown instanceof Error ? thrown.message : "").toBe(
      "E2153 KEEL_DATABASE_URL: SQLite cannot open or set up the database",
    );
    expect(seen.executed.at(-1)).toBe(last);
    expect(seen.closed).toBe(1);
  }
});
