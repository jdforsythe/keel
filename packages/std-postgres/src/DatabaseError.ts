import type { KeelError } from "@keel/schema";

/** A database error of a class a caller can act on (std.postgres): a statement timeout, a lock not available, a too long value, the app's own `raise`; its data is the five-character SQLSTATE and nothing of the error's text. */
export type DatabaseError = KeelError<"postgres.database", { readonly sqlstate: string }>;
