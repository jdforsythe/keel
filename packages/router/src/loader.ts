import type { Ctx } from "@keel/ctx";
import type { Infer, KeelError, Result, Schema, Secret } from "@keel/schema";
import type { Contract } from "./contract/types/Contract.ts";
import type { Entries } from "./contract/types/Entries.ts";
import { firstYield } from "./internal/firstYield.ts";
import { isSchema } from "./internal/isSchema.ts";
import { ownValue } from "./internal/ownValue.ts";
import { refuseSecret } from "./internal/refuseSecret.ts";
import { yields } from "./internal/yields.ts";
import type { Loader } from "./types/Loader.ts";
import type { LoaderInput } from "./types/LoaderInput.ts";

type None = Record<string, never>;
type InferOr<E, K extends string, D> = E extends { readonly [P in K]: infer S } ? Infer<S> : D;
type Out<T> = Result<T, KeelError<string, unknown>>;
type Args<E, St> = {
  readonly params: E extends { readonly layout: true } ? unknown : InferOr<E, "params", None>;
  readonly search: E extends { readonly layout: true }
    ? unknown
    : E extends { readonly method: unknown }
      ? InferOr<E, "query", None>
      : InferOr<E, "search", None>;
  readonly url: string;
  readonly caller: string;
  readonly user: string;
  readonly bearer: Secret<string> | undefined;
  readonly stores: St;
  readonly signal: AbortSignal;
};
type Stores<St> = { readonly stores?: (ctx: Ctx) => St };
type GetIds<C> = { [K in keyof C & string]: C[K] extends { readonly method: "GET" } ? K : never }[keyof C & string];
type LiveIds<C> = {
  [K in keyof C & string]: C[K] extends { readonly method: "GET"; readonly events: true } ? K : never;
}[keyof C & string];
type ViewIds<C> = {
  [K in keyof C & string]: C[K] extends { readonly method: unknown }
    ? never
    : C[K] extends { readonly path: string } | { readonly layout: true }
      ? K
      : never;
}[keyof C & string];
type Fn = (
  args: Omit<LoaderInput, "user" | "bearer"> & {
    readonly user: string;
    readonly bearer: Secret<string> | undefined;
    readonly signal: AbortSignal;
  },
  ctx: Ctx,
) => Promise<Out<unknown>> | AsyncGenerator<Out<unknown>>;

/** An `events: true` API GET entry's live loader: `fn` is an async generator of `Result`s of the entry's `output`. */
export function loader<M extends string, C extends Entries, K extends LiveIds<C>, St = undefined>(
  contract: Contract<M, C>,
  id: K,
  decl: Stores<St>,
  fn: (args: Args<C[K], NoInfer<St>>, ctx: Ctx) => AsyncGenerator<Out<InferOr<C[K], "output", never>>>,
): Loader<K, InferOr<C[K], "output", never>, true>;
/** An API GET entry's loader: `fn` answers a `Result` of the entry's `output`. */
export function loader<M extends string, C extends Entries, K extends GetIds<C>, St = undefined>(
  contract: Contract<M, C>,
  id: K,
  decl: Stores<St>,
  fn: (args: Args<C[K], NoInfer<St>>, ctx: Ctx) => Promise<Out<InferOr<C[K], "output", never>>>,
): Loader<K, InferOr<C[K], "output", never>, false>;
/** A page's or layout's loader: its `output` is the view's own, declared here. */
export function loader<M extends string, C extends Entries, K extends ViewIds<C>, T, St = undefined>(
  contract: Contract<M, C>,
  id: K,
  decl: { readonly output: Schema<T, boolean> } & Stores<St>,
  fn: (args: Args<C[K], NoInfer<St>>, ctx: Ctx) => Promise<Out<NoInfer<T>>>,
): Loader<K, T, false>;
/**
 * Declare the loader of entry `id` of `contract` (k.contract Handlers, k.server): `fn` gets `{ params, search, url,
 * caller, user, bearer, stores, signal }` typed from the entry (`search` is an API entry's `query`; a layout's
 * `params` and `search` are the matched route's, `unknown`) and `ctx`, and is never annotated. On an API GET `decl`
 * is `{ stores? }` and `fn` answers the entry's `output`, as an async generator (a live loader) on an `events: true`
 * entry only; on a page or layout `decl` is `{ output, stores? }`, and an `output` holding `s.secret` throws E1113.
 * `manifest` binds it under `id` only (E1515).
 */
export function loader(
  contract: Contract,
  id: string,
  decl: { readonly output?: Schema<unknown, boolean>; readonly stores?: (ctx: Ctx) => unknown },
  fn: Fn,
): Loader {
  const own = decl.output;
  const entry = ownValue(contract.entries, id);
  const declared = typeof entry === "object" && entry !== null ? ownValue(entry, "output") : undefined;
  const output = own ?? (isSchema(declared) ? declared : undefined);
  if (output === undefined) throw new TypeError(`loader("${id}"): no output (a page or layout loader declares one)`);
  if (own !== undefined) refuseSecret(own);
  const { stores } = decl;
  const run = (args: LoaderInput, ctx: Ctx): Promise<Out<unknown>> =>
    firstYield((signal) => fn({ ...args, user: args.user ?? "", bearer: args.bearer, signal }, ctx));
  const base = {
    kind: "keel.loader" as const,
    contract,
    id,
    output,
    ...(stores === undefined ? {} : { stores }),
    run,
  };
  if (Reflect.get(fn, Symbol.toStringTag) !== "AsyncGeneratorFunction") return Object.freeze(base);
  return Object.freeze({
    ...base,
    live: (a: LoaderInput & { readonly signal: AbortSignal }, ctx: Ctx) =>
      yields(fn({ ...a, user: a.user ?? "", bearer: a.bearer }, ctx)),
  });
}
