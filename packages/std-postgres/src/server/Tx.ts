import type { Result } from "@keel/schema";
import type { NoRows } from "../NoRows.ts";
import type { NotFound } from "../NotFound.ts";
import type { Query } from "../Query.ts";
import type { StatementError } from "../StatementError.ts";
import type { ChangedChannel } from "./ChangedChannel.ts";

/**
 * The statements of one `transaction` run (std.postgres): as the database's, inside the transaction, taking no plan
 * step. `changed(channel, params)` records a change of that channel instance, delivered once the transaction commits,
 * once per channel and key however often `fn` called it, never for a rollback or a run that did not commit.
 */
export interface Tx {
  query<T>(q: Query<T>): Promise<Result<T[], StatementError>>;
  one<T>(q: Query<T>): Promise<Result<T, StatementError | NotFound>>;
  run(q: Query<NoRows>): Promise<Result<number, StatementError>>;
  changed<P>(channel: ChangedChannel<P>, params: P): Promise<Result<null, StatementError>>;
}
