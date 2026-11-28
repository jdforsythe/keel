/**
 * What a thrown value is to std.postgres (std.postgres-errors): a constraint violation (class `23`), a serialization
 * failure or deadlock to run again, no answer (a refused, reset or lost connection and the codes taken as one), a
 * database error a caller can act on, a database answer no error takes (the defect E2461), or a value the database
 * did not throw (a driver's usage error), which passes on as it is.
 */
export type Answer = "constraint" | "rerun" | "lost" | "database" | "untaken" | "thrown";
