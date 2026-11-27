import type { KeelError } from "@keel/schema";
import { s } from "@keel/schema";

/**
 * `postgres.database` (std.postgres-errors): a database error of a class a caller can act on (a statement timeout, a
 * lock not available, a too long value, the app's own `raise`); its data is the five-character SQLSTATE and nothing of
 * the error's text. `DatabaseError.in(e)` finds it on `e`'s cause chain (k.attempt), a `keel.conflict`'s too.
 */
export const DatabaseError = s.error("postgres.database", s.object({ sqlstate: s.string() }));
export type DatabaseError = KeelError<"postgres.database", { readonly sqlstate: string }>;
