import type { Conflict } from "./Conflict.ts";
import type { ConstraintError } from "./ConstraintError.schema.ts";
import type { DatabaseError } from "./DatabaseError.schema.ts";
import type { ResultError } from "./ResultError.schema.ts";
import type { Unreachable } from "./Unreachable.ts";

/** What a statement can answer instead of its rows (std.postgres). */
export type StatementError = ResultError | ConstraintError | DatabaseError | Unreachable | Conflict;
