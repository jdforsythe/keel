import { register } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import type { Database } from "./Database.type.ts";
import type { DatabaseOptions } from "./DatabaseOptions.ts";
import type { Backend } from "./internal/Backend.ts";
import type { Migration } from "./internal/Migration.ts";
import { Step } from "./internal/Step.ts";
import { foundMigrations } from "./internal/foundMigrations.ts";
import { makeDatabase } from "./internal/makeDatabase.ts";
import { migrationFiles } from "./internal/migrationFiles.ts";
import { realBackend } from "./internal/realBackend.ts";
import { simBackend } from "./internal/simBackend.ts";

/** What the registry holds per ctx: the database, made at its first access with the ctx's clock. */
type Side = { at(ctx: Ctx): Database };

const sideOf = (name: string, backend: Backend, steps?: readonly Step[]): Side => {
  let db: Database | undefined;
  return {
    at(ctx) {
      db ??= makeDatabase(name, backend, steps === undefined ? undefined : { steps, clock: ctx.clock });
      return db;
    },
  };
};

/**
 * A database capability named `name` (`<moduleId>.<name>`, std.postgres). Its tables are made by the files
 * `modules/<moduleId>/migrations/*.sql` of the app folder, read at its first call, or by `opts.migrations` when given.
 * Registers a real, shell and sim side (k.ctx) and returns the accessor: `kitchenDb(ctx)` is the same `Database` for a
 * ctx at every call. Names that are not `NNNN-<kebab>.sql` from 0001 without a gap throw E2453: here for a given map,
 * at the first call for found files.
 */
export function database(name: string, opts: DatabaseOptions = {}): (ctx: Ctx) => Database {
  const given = opts.migrations === undefined ? undefined : migrationFiles(name, opts.migrations);
  let found: readonly Migration[] | undefined;
  const files = (): readonly Migration[] => {
    if (given !== undefined) return given;
    found ??= migrationFiles(name, foundMigrations(name));
    return found;
  };
  const real = (): Side => sideOf(name, realBackend(name, files));
  const accessor = register<Side, Step>(name, {
    real,
    shell: real,
    sim: ({ seed, plan, hold }) =>
      sideOf(
        name,
        simBackend(name, files, seed, (work) => hold(work, `${name} query`)),
        plan,
      ),
    plan: Step,
  });
  return (ctx) => accessor(ctx).at(ctx);
}
