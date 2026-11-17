import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result, Schema, Secret } from "@keel/schema";
import { refuseSecret } from "./internal/refuseSecret.ts";
import type { Action } from "./types/Action.ts";
import type { ApiAction } from "./types/ApiAction.ts";
import type { Href } from "./types/Href.ts";

type Out<T> = Result<T, KeelError<string, unknown>>;
type PageAt<P, St> = { readonly params: P; readonly url: string; readonly caller: string; readonly stores: St };
type ApiAt<P, St> = PageAt<P, St> & { readonly bearer: Secret<string> | undefined };
type Built<I, R, P, St> = {
  readonly kind: "keel.action";
  readonly input: ObjectSchema<I>;
  readonly output?: Schema<R>;
  readonly params?: ObjectSchema<P>;
  readonly stores?: (ctx: Ctx) => St;
  run(
    input: I,
    at: PageAt<P, St> & { readonly bearer?: Secret<string> | undefined },
    ctx: Ctx,
  ): Out<R> | Promise<Out<R>>;
};

/**
 * Declare a route action (k.server API, k.api Output). `fn` gets the input decoded by `input`, `{ params, url, caller,
 * stores }`, and `ctx`. With `output` it is an API route's action: `fn` returns `ok(value)` of `output`'s type and also
 * gets `bearer` (k.api Bearer). Without it it is a page's: `ok(href)` navigates there, `ok(null)` revalidates the
 * current chain. `params` is `Infer` of the declared schema (`unknown` when omitted), which must be the referencing
 * route's own value (`manifest` throws E1507); `fn` is never annotated. `url` is the absolute request URL. `stores`
 * names a server-state factory whose per-request instance `fn` gets (k.server Server state). An `output` holding an
 * `s.secret` node throws E1113.
 */
export function action<I, O, P = unknown, St = undefined>(
  decl: {
    readonly input: ObjectSchema<I>;
    readonly output: Schema<O>;
    readonly params?: ObjectSchema<P>;
    readonly stores?: (ctx: Ctx) => St;
  },
  fn: (input: I, at: ApiAt<NoInfer<P>, NoInfer<St>>, ctx: Ctx) => Out<NoInfer<O>> | Promise<Out<NoInfer<O>>>,
): ApiAction<I, O, P, St>;
export function action<I, P = unknown, St = undefined>(
  decl: { readonly input: ObjectSchema<I>; readonly params?: ObjectSchema<P>; readonly stores?: (ctx: Ctx) => St },
  fn: (input: I, at: PageAt<NoInfer<P>, NoInfer<St>>, ctx: Ctx) => Out<Href | null> | Promise<Out<Href | null>>,
): Action<I, P, St>;
export function action<I, R, P, St>(
  decl: {
    readonly input: ObjectSchema<I>;
    readonly output?: Schema<R>;
    readonly params?: ObjectSchema<P>;
    readonly stores?: (ctx: Ctx) => St;
  },
  fn: (input: I, at: ApiAt<P, St>, ctx: Ctx) => Out<R> | Promise<Out<R>>,
): Built<I, R, P, St> {
  const { input, output, params, stores } = decl;
  if (output !== undefined) refuseSecret(output);
  return Object.freeze({
    kind: "keel.action",
    input,
    ...(output === undefined ? {} : { output }),
    ...(params === undefined ? {} : { params }),
    ...(stores === undefined ? {} : { stores }),
    run:
      output === undefined
        ? fn
        : (i: I, at: PageAt<P, St> & { readonly bearer?: Secret<string> | undefined }, ctx: Ctx) =>
            fn(i, { ...at, bearer: at.bearer }, ctx),
  });
}
