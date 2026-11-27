import { s } from "@keel/schema";

/** `postgres.database` (std.postgres-errors): a database answer a caller can act on, its data the SQLSTATE alone. */
export const databaseError = s.error("postgres.database", s.object({ sqlstate: s.string() }));
