import { register } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import type { Database } from "./Database.type.ts";
import type { DatabaseOptions } from "./DatabaseOptions.ts";
import type { Backend } from "./internal/Backend.ts";
import { Step } from "./internal/Step.ts";
import { makeDatabase } from "./internal/makeDatabase.ts";
import { migrationFiles } from "./internal/migrationFiles.ts";
import { realBackend } from "./internal/realBackend.ts";
import { simBackend } from "./internal/simBackend.ts";

/** What the registry holds per ctx: the database, made at its first access with the ctx's clock. */
type Side = { at(ctx: Ctx): Database };

const sideOf = (backend: Backend, steps?: readonly Step[]): Side => {
  let db: Database | undefined;
  return {
    at(ctx) {
      db ??= makeDatabase(backend, steps === undefined ? undefined : { steps, clock: ctx.clock });
      return db;
    },
  };
};

/**
 * A database capability named `name` (`<moduleId>.<name>`, std.postgres), its tables made by `migrations`. Registers
 * a real, shell and sim side (k.ctx) and returns the accessor: `kitchenDb(ctx)` is the same `Database` for a ctx at
 * every call. Migration keys that are not `./migrations/NNNN-<kebab>.sql` from 0001 without a gap throw E2453 here.
 */
export function database(name: string, opts: DatabaseOptions): (ctx: Ctx) => Database {
  const files = migrationFiles(name, opts.migrations);
  const real = (): Side => sideOf(realBackend(name, files));
  const accessor = register<Side, Step>(name, {
    real,
    shell: real,
    sim: ({ seed, plan }) => sideOf(simBackend(name, files, seed), plan),
    plan: Step,
  });
  return (ctx) => accessor(ctx).at(ctx);
}
