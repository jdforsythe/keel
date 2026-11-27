import { ConstraintError } from "../../ConstraintError.schema.ts";
import { DatabaseError } from "../../DatabaseError.schema.ts";
import type { Unreachable } from "../../Unreachable.ts";
import { ConstraintName } from "./ConstraintName.schema.ts";
import { Sqlstate } from "./Sqlstate.schema.ts";
import { constraintKind } from "./constraintKind.server.ts";
import { errors } from "./errors.server.ts";
import { field } from "./field.server.ts";
import { isAnswer } from "./isAnswer.server.ts";
import { noErrorTakes } from "./noErrorTakes.server.ts";

/**
 * The `expect` of a statement's `attempt` (std.postgres-errors): a constraint violation is `postgres.constraint`, a
 * rerun and a database error a caller acts on `postgres.database` holding the SQLSTATE only, no answer
 * `keel.unreachable`; any other answer of the database (one no error takes, or a name or code no schema here takes) is
 * the defect E2461; a value that is not the database's passes on as thrown.
 */
export function answered(x: unknown): ConstraintError | DatabaseError | Unreachable | undefined {
  const name = ConstraintName.parse(field(x, "constraint") || field(x, "column"));
  const sqlstate = Sqlstate.parse(field(x, "code"));
  if (name.ok && isAnswer(x, "constraint"))
    return ConstraintError.make({ constraint: name.value, kind: constraintKind(x) }, "A row breaks a constraint");
  if (sqlstate.ok && isAnswer(x, "rerun"))
    return DatabaseError.make({ sqlstate: sqlstate.value }, "The database ran the statement into a conflict");
  if (sqlstate.ok && isAnswer(x, "database"))
    return DatabaseError.make({ sqlstate: sqlstate.value }, "The database refused the statement");
  if (isAnswer(x, "lost")) return errors.unreachable;
  if (!isAnswer(x, "thrown")) noErrorTakes(field(x, "code"));
  return undefined;
}
