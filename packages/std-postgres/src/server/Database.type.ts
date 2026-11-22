import type { Result } from "@keel/schema";
import type { Conflict } from "../Conflict.ts";
import type { ConstraintError } from "../ConstraintError.ts";
import type { NoRows } from "../NoRows.ts";
import type { NotFound } from "../NotFound.ts";
import type { Query } from "../Query.ts";
import type { StatementError } from "../StatementError.ts";
import type { Unreachable } from "../Unreachable.ts";
import type { TransactionOptions } from "./TransactionOptions.ts";
import type { Tx } from "./Tx.ts";
import type { ErrorOf } from "./internal/ErrorOf.ts";
import type { ValueOf } from "./internal/ValueOf.ts";

/**
 * A database capability on one ctx (std.postgres). `query`: every row, parsed by the statement's schema. `one`: the one
 * row; none is `keel.notFound`, more than one rejects. `run`: the count of rows changed; a row is `postgres.result`.
 * Each lone `query`, `one` and `run` is its own `serializable` transaction; a write using another call's read goes in
 * one `transaction` with it. `transaction(fn)`: `fn(tx)` in one `serializable` transaction, so committed ones have the
 * effect of some serial order; `ok` commits, `err` or a throw rolls back. `{ allow: 'write skew', reason }` runs it at
 * `repeatable read`, `{ allow: 'lost updates', reason }` at `read committed`. A serialization failure or deadlock runs
 * a lone statement or `fn` again, at most 3 runs, then is `keel.conflict`; what `fn` does outside `tx` must be safe to
 * repeat. A constraint checked at commit is `postgres.constraint`.
 */
export interface Database {
  query<T>(q: Query<T>): Promise<Result<T[], StatementError>>;
  one<T>(q: Query<T>): Promise<Result<T, StatementError | NotFound>>;
  run(q: Query<NoRows>): Promise<Result<number, StatementError>>;
  transaction<R extends Result<unknown, unknown>>(
    fn: (tx: Tx) => Promise<R>,
    opts?: TransactionOptions,
  ): Promise<Result<ValueOf<R>, ErrorOf<R> | ConstraintError | Unreachable | Conflict>>;
}
