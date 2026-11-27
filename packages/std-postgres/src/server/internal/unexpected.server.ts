import { field } from "./field.server.ts";
import { noErrorTakes } from "./noErrorTakes.server.ts";

/**
 * What a database error that no error takes does: the defect E2461, its `data` the SQLSTATE alone, since Postgres's
 * message can quote a value. An error that is not the database's (no `severity`: a driver's usage error) gives
 * `undefined`, so `attempt` passes it on as it is.
 */
export function unexpected(e: unknown): undefined {
  if (field(e, "severity") === "") return undefined;
  return noErrorTakes(field(e, "code"));
}
