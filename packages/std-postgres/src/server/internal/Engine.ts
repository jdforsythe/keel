import type { Isolation } from "../Isolation.ts";
import type { Conn } from "./Conn.ts";
import type { Raw } from "./Raw.ts";
import type { TypeCache } from "./TypeCache.ts";

/**
 * A Postgres engine (`pg` or PGlite). `statement` runs one statement outside a transaction. `tx` runs `fn` on one
 * session in a transaction at `isolation`: it commits when `fn` resolves `commit: true`, rolls back otherwise or on a
 * throw. `types` decodes what its rows hold.
 */
export type Engine = {
  statement(text: string, params: readonly (string | null)[]): Promise<Raw>;
  tx<T>(isolation: Isolation, fn: (c: Conn) => Promise<{ readonly value: T; readonly commit: boolean }>): Promise<T>;
  readonly types: TypeCache;
};
