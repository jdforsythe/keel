import type { Conflict } from "./Conflict.ts";
import type { ConstraintError } from "./ConstraintError.ts";
import type { DatabaseError } from "./DatabaseError.ts";
import type { ResultError } from "./ResultError.ts";
import type { Unreachable } from "./Unreachable.ts";

/** What a statement can answer instead of its rows (std.postgres). */
export type StatementError = ResultError | ConstraintError | DatabaseError | Unreachable | Conflict;
