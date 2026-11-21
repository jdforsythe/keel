// Shared fixtures for the std.postgres conformance files (not a test file).
// Assumption: the accessor `database(name, { migrations })(ctx)` returns `{ query, one, run, transaction }` (spec: API); each result is a `Result`.
// Assumption: `createCtx({ mode: 'real' })` is enough for a real ctx; `KEEL_POSTGRES_URL` is set before the first query and restored after.
// Assumption: `fragment(strings)` also works as a plain call with a TemplateStringsArray (`sqlName`), the one way a test names a per-test table.
// Assumption: a database name is made unique per test (`t.db<N>`), and so are its tables, so files can share one Postgres 17 (`KEEL_TEST_POSTGRES_URL`).
// Assumption: a `pglite:<folder>` URL is used for the real-mode PGlite runs, each in a fresh temporary folder.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { s } from "@keel/schema";
import type { Result } from "@keel/schema";
import { fragment } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { ready } from "@keel/std-postgres/testing";

export const SEED = 1337;
export const PG17 = process.env.KEEL_TEST_POSTGRES_URL ?? "";

let counter = 0;
export function fresh(): { cap: string; table: string } {
  counter += 1;
  return { cap: `t.db${counter}`, table: `t_${counter}_${process.pid}` };
}

export const Row = s.object({ id: s.int(), name: s.string() });

export const migrationsOf = (...texts: string[]): Record<string, string> =>
  Object.fromEntries(texts.map((t, i) => [`./migrations/${String(i + 1).padStart(4, "0")}-m${i + 1}.sql`, t]));

/** A database with one table `table (id int primary key, name text constraint <table>_name_key unique)`. */
export function notesDb(cap: string, table: string) {
  return database(cap, {
    migrations: migrationsOf(
      `create table ${table} (id int primary key, name text constraint ${table}_name_key unique)`,
    ),
  });
}

export function simCtx(
  cap: string,
  plan: { delay: number; fault: "none" | "unavailable" | "conflict" }[] = [],
  seed = SEED,
): Ctx {
  return createCtx({ mode: "sim", seed, schedule: { net: [], storage: [], offline: [], plans: { [cap]: plan } } });
}

export const none = (n: number) => Array.from({ length: n }, () => ({ delay: 0, fault: "none" as const }));

export function errOf<T, E>(r: Result<T, E>): E {
  if (r.ok) throw new Error("expected err, got ok");
  return r.error;
}
export function okOf<T, E>(r: Result<T, E>): T {
  if (!r.ok) throw new Error(`expected ok, got err ${JSON.stringify(r.error)}`);
  return r.value;
}

export type Mode = { name: string; ctx(cap: string): Promise<Ctx>; done(): void };
export type ModeMaker = { name: string; make(): Mode };

function realMode(name: string, url: () => string): ModeMaker {
  return {
    name,
    make() {
      const before = process.env.KEEL_POSTGRES_URL;
      const dir = mkdtempSync(join(tmpdir(), "keel-pg-"));
      return {
        name,
        async ctx() {
          process.env.KEEL_POSTGRES_URL = url().replace("<dir>", dir);
          return createCtx({ mode: "real", seed: SEED });
        },
        done() {
          if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
          else process.env.KEEL_POSTGRES_URL = before;
          rmSync(dir, { recursive: true, force: true });
        },
      };
    },
  };
}

const simMode: ModeMaker = {
  name: "sim",
  make: () => ({
    name: "sim",
    async ctx(cap) {
      await ready();
      return simCtx(cap, none(500));
    },
    done() {},
  }),
};

/** Sim and PGlite always; Postgres 17 only with `KEEL_TEST_POSTGRES_URL`. */
export const MODES: ModeMaker[] = [
  simMode,
  realMode("pglite", () => "pglite:<dir>"),
  ...(PG17 === "" ? [] : [realMode("postgres 17", () => PG17)]),
];

export const hasPg17 = PG17 !== "";

/** A `TemplateStringsArray` made from plain strings, so a test can name a table that differs per test. */
export const tpl = (parts: string[]): TemplateStringsArray => Object.assign([...parts], { raw: [...parts] });
/** A fragment holding the table's name, spliced with `${sqlName(table)}` (the only way text enters a query). */
export const sqlName = (table: string) => fragment(tpl([table]));
