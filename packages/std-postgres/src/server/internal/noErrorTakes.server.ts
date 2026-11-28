import { defect } from "@keel/schema";

/** The defect E2461 (std.postgres-errors): a database answer no error takes, naming its SQLSTATE in `data` only. */
export function noErrorTakes(sqlstate: string): never {
  return defect("std.postgres: the database answered an SQLSTATE no error takes", {
    code: "E2461",
    data: { sqlstate },
  });
}
