import type { Conn } from "./Conn.ts";
import type { Level } from "./Level.ts";
import type { Raw } from "./Raw.ts";
import type { TypeCache } from "./TypeCache.ts";

/**
 * A Postgres engine (`pg` or PGlite). `statement` runs one statement as its own `serializable` transaction. `tx` runs `fn` on one
 * session in a transaction at `level`: it commits when `fn` resolves `commit: true`, rolls back otherwise or on a
 * throw. `types` decodes what its rows hold.
 */
export type Engine = {
  statement(text: string, params: readonly (string | null)[]): Promise<Raw>;
  tx<T>(level: Level, fn: (c: Conn) => Promise<{ readonly value: T; readonly commit: boolean }>): Promise<T>;
  readonly types: TypeCache;
};
