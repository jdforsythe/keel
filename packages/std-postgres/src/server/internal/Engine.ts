import type { Conn } from "./Conn.ts";
import type { Held } from "./Held.ts";
import type { Level } from "./Level.ts";
import type { Raw } from "./Raw.ts";
import type { TypeCache } from "./TypeCache.server.ts";

/**
 * A Postgres engine (`pg` or PGlite). `statement` runs one statement as its own `serializable` transaction. `tx` runs `fn` on one
 * session in a transaction at `level`: it commits when `fn` resolves `commit: true`, rolls back otherwise or on a
 * throw. `types` decodes what its rows hold. With `held` (sim) each call into the database, `begin` and `commit` or
 * `rollback` included, goes through it, after the wait for the engine's one session and never around `fn`.
 */
export type Engine = {
  statement(text: string, params: readonly (string | null)[], held?: Held): Promise<Raw>;
  tx<T>(
    level: Level,
    fn: (c: Conn) => Promise<{ readonly value: T; readonly commit: boolean }>,
    held?: Held,
  ): Promise<T>;
  readonly types: TypeCache;
};
