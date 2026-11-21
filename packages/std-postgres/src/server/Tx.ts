import type { Result } from "@keel/schema";
import type { NoRows } from "../NoRows.ts";
import type { NotFound } from "../NotFound.ts";
import type { Query } from "../Query.ts";
import type { StatementError } from "../StatementError.ts";

/** The statements of one `transaction` run (std.postgres): as the database's, inside the transaction, taking no plan step. */
export interface Tx {
  query<T>(q: Query<T>): Promise<Result<T[], StatementError>>;
  one<T>(q: Query<T>): Promise<Result<T, StatementError | NotFound>>;
  run(q: Query<NoRows>): Promise<Result<number, StatementError>>;
}
