import { s } from "@keel/schema";
import { SQLSTATES } from "../../internal/SQLSTATES.ts";

/** An SQLSTATE `postgres.database` carries (std.postgres-errors): one of `SQLSTATES`, read by `sqlstateOf`. */
export const Sqlstate = s.enum(SQLSTATES);
