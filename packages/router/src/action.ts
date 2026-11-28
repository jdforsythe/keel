import type { Ctx } from "@keel/ctx";
import {
  type Infer,
  type KeelError,
  type ObjectSchema,
  type Result,
  type Schema,
  type Secret,
  isObjectSchema,
  isSchema,
  s,
} from "@keel/schema";
import type { Contract } from "./contract/types/Contract.ts";
import type { Entries } from "./contract/types/Entries.ts";
import { madeFrozen } from "./internal/madeFrozen.ts";
import { ownValue } from "./internal/ownValue.ts";
import { withStores } from "./internal/withStores.ts";
import { routeTable } from "./routeTable.ts";
import type { Action } from "./types/Action.ts";
import type { ApiAction } from "./types/ApiAction.ts";
import type { Href } from "./types/Href.ts";
import type { RouteTable } from "./types/RouteTable.ts";

type None = Record<string, never>;
type InferOr<E, K extends string, D> = E extends { readonly [P in K]: infer S } ? Infer<S> : D;
type Out<T> = Result<T, KeelError<string, unknown>>;
type PageAt<E, St> = {
  readonly params: InferOr<E, "params", None>;
  readonly url: string;
  readonly caller: string;
  readonly user: string;
  readonly stores: St;
  readonly routes: RouteTable;
};
type ApiAt<E, St> = PageAt<E, St> & { readonly bearer: Secret<string> | undefined };
type Stores<St> = { readonly stores?: (ctx: Ctx) => St };
type WriteIds<C> = {
  [K in keyof C & string]: C[K] extends { readonly method: "POST" | "PUT" | "PATCH" | "DELETE" } ? K : never;
}[keyof C & string];
type PageIds<C> = {
  [K in keyof C & string]: C[K] extends { readonly method: unknown }
    ? never
    : C[K] extends { readonly path: string }
      ? K
      : never;
}[keyof C & string];
type At<P, St> = {
  readonly params: P;
  readonly url: string;
  readonly caller: string;
  readonly user: string;
  readonly bearer: Secret<string> | undefined;
  readonly stores: St;
  readonly routes: RouteTable;
};
type RunAt<P, St> = Omit<At<P, St>, "user" | "bearer" | "stores" | "routes"> & {
  readonly routes?: RouteTable;
  readonly stores?: St;
  readonly user?: string;
  readonly bearer?: Secret<string> | undefined;
};

/** What `action` builds: a page's `Action` or an API entry's `ApiAction`. */
type Built<I, P, St> = {
  readonly kind: "keel.action";
  readonly contract: Contract;
  readonly id: string;
  readonly input: ObjectSchema<unknown>;
  readonly output?: Schema<unknown, boolean> | undefined;
  readonly stores?: (ctx: Ctx) => St;
  run(input: I, at: RunAt<P, St>, ctx: Ctx): Out<unknown> | Promise<Out<unknown>>;
};

/** The table `run` gives `fn` when its args carry none: no pages, so every `pageHref` read is refused. */
let none: RouteTable | undefined;

/** The closed empty object: an API write entry's body when it declares none. */
const EMPTY: ObjectSchema<unknown> = s.object({});

/** An API write entry's action: `fn` gets the decoded `body` and answers a `Result` of the entry's `output`. */
export function action<M extends string, C extends Entries, K extends WriteIds<C>, St = undefined>(
  contract: Contract<M, C>,
  id: K,
  decl: Stores<St>,
  fn: (
    body: InferOr<C[K], "body", None>,
    at: ApiAt<C[K], NoInfer<St>>,
    ctx: Ctx,
  ) => Out<InferOr<C[K], "output", never>> | Promise<Out<InferOr<C[K], "output", never>>>,
): ApiAction<K, InferOr<C[K], "output", never>>;
/** A page's action: its `input` is the form's own; it answers a page to go to, or `null` to revalidate. */
export function action<M extends string, C extends Entries, K extends PageIds<C>, I, St = undefined>(
  contract: Contract<M, C>,
  id: K,
  decl: { readonly input: ObjectSchema<I> } & Stores<St>,
  fn: (input: I, at: PageAt<C[K], NoInfer<St>>, ctx: Ctx) => Out<Href | null> | Promise<Out<Href | null>>,
): Action<K>;
/**
 * Declare an action of entry `id` of `contract` (k.contract Handlers, k.server): `fn` is never annotated. On an API
 * write entry `decl` is `{ stores? }`; `fn` gets the `body` decoded by the entry's schema (the closed empty object
 * without one), `{ params, url, caller, user, bearer, stores, routes }` and `ctx`, and answers the entry's `output` (k.api
 * Output). On a page `decl` is `{ input, stores? }`; `fn` gets the decoded form, `{ params, url, caller, user, stores }`
 * and `ctx`, and answers `ok(href)` or `ok(null)`; its verb is its binding key. Throws nothing.
 */
export function action<I, P, St>(
  contract: Contract,
  id: string,
  decl: { readonly input?: ObjectSchema<unknown>; readonly stores?: (ctx: Ctx) => St },
  fn: (input: I, at: At<P, St | undefined>, ctx: Ctx) => Out<unknown> | Promise<Out<unknown>>,
): Built<I, P, St> {
  const entry = ownValue(contract.entries, id);
  const at = typeof entry === "object" && entry !== null ? entry : {};
  const { stores } = decl;
  const run = (input: I, a: RunAt<P, St>, ctx: Ctx) => {
    none ??= routeTable();
    const routes = a.routes ?? none;
    return a.stores !== undefined || stores === undefined
      ? fn(input, { ...a, user: a.user ?? "", bearer: a.bearer, stores: a.stores, routes }, ctx)
      : withStores(stores, undefined, ctx, (st) =>
          fn(input, { ...a, user: a.user ?? "", bearer: a.bearer, stores: st, routes }, ctx),
        );
  };
  const base = { kind: "keel.action" as const, contract, id, ...(stores === undefined ? {} : { stores }), run };
  const output = ownValue(at, "output");
  if (decl.input === undefined && isSchema(output)) {
    const body = ownValue(at, "body");
    return madeFrozen({ ...base, input: isObjectSchema(body) ? body : EMPTY, output }, "action");
  }
  return madeFrozen({ ...base, input: decl.input ?? EMPTY }, "action");
}
