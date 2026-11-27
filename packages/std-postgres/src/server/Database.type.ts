import type { KeelError, Result } from "@keel/schema";
import type { Conflict } from "../Conflict.ts";
import type { ConstraintError } from "../ConstraintError.ts";
import type { DatabaseError } from "../DatabaseError.schema.ts";
import type { NoRows } from "../NoRows.schema.ts";
import type { NotFound } from "../NotFound.ts";
import type { Query } from "../Query.ts";
import type { StatementError } from "../StatementError.ts";
import type { Unreachable } from "../Unreachable.ts";
import type { ChangedChannel } from "./ChangedChannel.ts";
import type { FollowEvent } from "./FollowEvent.ts";
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
 * repeat. A constraint checked at commit is `postgres.constraint`. `changed(channel, params)`: a change of that channel
 * instance as its own transaction (`pg_notify`), delivered once it commits; params failing the channel's schema, or a
 * payload over 7,900 bytes, throw E2460 before any statement. `follow(channel, key, on)`: `on({ kind: 'changed' })` for
 * each committed change of this capability, channel name and key (the canonical JSON of the params) on any process
 * using the URL, `on({ kind: 'lost' })` once if delivery stops; resolves the stop once listening.
 */
export interface Database {
  query<T>(q: Query<T>): Promise<Result<T[], StatementError>>;
  one<T>(q: Query<T>): Promise<Result<T, StatementError | NotFound>>;
  run(q: Query<NoRows>): Promise<Result<number, StatementError>>;
  transaction<R extends Result<unknown, KeelError<string, unknown>>>(
    fn: (tx: Tx) => Promise<R>,
    opts?: TransactionOptions,
  ): Promise<Result<ValueOf<R>, ErrorOf<R> | ConstraintError | DatabaseError | Unreachable | Conflict>>;
  changed<P>(channel: ChangedChannel<P>, params: P): Promise<Result<null, StatementError>>;
  follow(channel: { readonly name: string }, key: string, on: (e: FollowEvent) => void): Promise<() => void>;
}
