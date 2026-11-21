import type { Result } from "@keel/schema";
import type { Conflict } from "../Conflict.ts";
import type { ConstraintError } from "../ConstraintError.ts";
import type { NoRows } from "../NoRows.ts";
import type { NotFound } from "../NotFound.ts";
import type { Query } from "../Query.ts";
import type { StatementError } from "../StatementError.ts";
import type { Unreachable } from "../Unreachable.ts";
import type { Isolation } from "./Isolation.ts";
import type { Tx } from "./Tx.ts";

/**
 * A database capability on one ctx (std.postgres). `query`: every row, parsed by the statement's schema. `one`: the one
 * row; none is `keel.notFound`, more than one rejects. `run`: the count of rows changed; a row is `postgres.result`.
 * `transaction(fn)`: `fn(tx)` in one transaction; `ok` commits, `err` or a throw rolls back; a serialization failure or
 * deadlock runs `fn` again, at most 3 runs, then is `keel.conflict`; a constraint
 * checked at commit is `postgres.constraint`.
 */
export interface Database {
  query<T>(q: Query<T>): Promise<Result<T[], StatementError>>;
  one<T>(q: Query<T>): Promise<Result<T, StatementError | NotFound>>;
  run(q: Query<NoRows>): Promise<Result<number, StatementError>>;
  transaction<T, E>(
    fn: (tx: Tx) => Promise<Result<T, E>>,
    opts?: { readonly isolation?: Isolation },
  ): Promise<Result<T, E | ConstraintError | Unreachable | Conflict>>;
}
