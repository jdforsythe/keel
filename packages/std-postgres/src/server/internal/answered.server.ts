import type { ConstraintError } from "../../ConstraintError.ts";
import type { DatabaseError } from "../../DatabaseError.ts";
import type { Unreachable } from "../../Unreachable.ts";
import { classify } from "./classify.server.ts";
import { unexpected } from "./unexpected.server.ts";

/**
 * The `expect` of a statement's `attempt`: a driver error as std.postgres answers it (`classify`); a database error
 * no error takes is the defect E2461; one that is not the database's passes on as thrown.
 */
export function answered(e: unknown): ConstraintError | DatabaseError | Unreachable | undefined {
  return classify(e) ?? unexpected(e);
}
