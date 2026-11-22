import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Schema } from "@keel/schema";
import type { Contract } from "../contract/types/Contract.ts";
import type { LiveInput } from "./LiveInput.ts";
import type { LoaderInput } from "./LoaderInput.ts";

type Out<T> = Result<T, KeelError<string, unknown>>;

/**
 * A loader declared with `loader(contract, id, decl, fn)` for entry `Id` (k.contract Handlers). `output` is the API
 * entry's or, on a page or layout, the declared one. `run` answers once; a live loader (`Live`, an `events: true`
 * entry's async generator) also has `live`, every yield until it returns or `signal` aborts, and its `run` is the
 * first yield (k.server); `live`'s `currentUser` is the server's (k.user), else one answering `user`.
 */
export type Loader<Id extends string = string, T = unknown, Live extends boolean = boolean> = {
  readonly kind: "keel.loader";
  readonly contract: Contract;
  readonly id: Id;
  readonly output: Schema<T, boolean>;
  readonly stores?: (ctx: Ctx) => unknown;
  run(args: LoaderInput, ctx: Ctx): Promise<Out<T>>;
} & (Live extends true
  ? { live(args: LiveInput, ctx: Ctx): AsyncIterable<Out<T>> }
  : { readonly live?: undefined });
