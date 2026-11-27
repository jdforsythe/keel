import { ConstraintError } from "../../ConstraintError.schema.ts";
import { DatabaseError } from "../../DatabaseError.schema.ts";
import type { Unreachable } from "../../Unreachable.ts";
import { errors } from "./errors.server.ts";
import { field } from "./field.server.ts";

const KINDS: Readonly<Record<string, ConstraintError["data"]["kind"]>> = {
  "23505": "unique",
  "23P01": "unique",
  "23503": "foreign",
  "23001": "foreign",
  "23514": "check",
  "23502": "notNull",
};
/** No answer (std.postgres-errors): each code by itself, class `08` not by its prefix. */
const LOST = new Set(["08000", "08001", "08003", "08006", "57P01", "57P02", "57P03", "53300"]);
const RERUNS = new Set(["40001", "40P01"]);
/** `postgres.database`: classes `22`, `40`, `53`, `54`, `55`, `57` and `P0` (less the codes `LOST` holds) and `08007`. */
const DATABASE = /^(?:(?:22|40|53|54|55|57|P0)[0-9A-Z]{3}|08007)$/;
const NET = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "EPIPE", "EHOSTUNREACH", "EAI_AGAIN"]);
const DROPPED =
  /Connection terminated|connection timeout|timeout exceeded when trying to connect|Client has encountered a connection error/i;

/**
 * A driver error as std.postgres-errors answers it: class `23` is `postgres.constraint`; a refused, reset or lost
 * connection, `57P01` to `57P03`, `53300`, `08000`, `08001`, `08003` and `08006` are `keel.unreachable`; `40001` and
 * `40P01` (run again by the caller), `08007` and a database error of class `22`, `40`, `53`, `54`, `55`, `57` or `P0`
 * are `postgres.database` holding the SQLSTATE only; anything else `null`, for `unexpected` to decide.
 */
export function classify(e: unknown): ConstraintError | DatabaseError | Unreachable | null {
  const code = field(e, "code");
  if (code.startsWith("23")) {
    const constraint = field(e, "constraint") || field(e, "column");
    const kind = KINDS[code] ?? "check";
    return ConstraintError.make({ constraint, kind }, "A row breaks a constraint");
  }
  if (RERUNS.has(code)) return DatabaseError.make({ sqlstate: code }, "The database ran the statement into a conflict");
  if (LOST.has(code) || NET.has(code)) return errors.unreachable;
  if (code === "" && e instanceof Error && DROPPED.test(e.message)) return errors.unreachable;
  if (field(e, "severity") !== "" && DATABASE.test(code))
    return DatabaseError.make({ sqlstate: code }, "The database refused the statement");
  return null;
}
