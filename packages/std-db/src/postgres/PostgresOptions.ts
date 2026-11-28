import type { PgPool } from "./PgPool.ts";

/**
 * Options of `postgres(url, options)`. `clientFactory` returns the pool the driver uses in place of a `pg` `Pool` of 10
 * on `url` (an in-process database in tests); the driver ends it on `close()`.
 */
export type PostgresOptions = { readonly clientFactory?: () => PgPool };
