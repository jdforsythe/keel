import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result, Schema, Secret } from "@keel/schema";
import { firstYield } from "./internal/firstYield.ts";
import { refuseSecret } from "./internal/refuseSecret.ts";
import { yields } from "./internal/yields.ts";
import type { Loader } from "./types/Loader.ts";

type Args<P, S, St> = {
  readonly params: P;
  readonly search: S;
  readonly url: string;
  readonly caller: string;
  readonly user: string;
  readonly bearer: Secret<string> | undefined;
  readonly stores: St;
};
/** What `run` and `live` take: `user` and `bearer` may be left out by a direct caller; `fn` then gets `""` and `undefined`. */
type RunArgs<P, S, St> = Omit<Args<P, S, St>, "user" | "bearer"> & {
  readonly user?: string;
  readonly bearer?: Secret<string>;
};
type Out<T> = Result<T, KeelError<string, unknown>>;
type Fn<T, P, S, St> = (
  args: Args<P, S, St> & { readonly signal: AbortSignal },
  ctx: Ctx,
) => Promise<Out<T>> | AsyncGenerator<Out<T>>;
type Decl<T, P, S, St> = {
  readonly output: Schema<T>;
  readonly params?: ObjectSchema<P>;
  readonly search?: ObjectSchema<S>;
  readonly stores?: (ctx: Ctx) => St;
};

/**
 * Declare a route loader (k.server API): `fn` gets `{ params, search, url, caller, user, bearer, stores }` and `ctx`, and returns a
 * Result whose `ok` value is encoded with `output`. `params`/`search` are `Infer` of the declared schemas (`unknown`
 * when omitted), which must be the referencing route's own values (`manifest` throws E1507); `fn` is never annotated.
 * `url` is the absolute request URL. `stores` names a server-state factory whose per-request instance `fn` gets
 * (k.server Server state). The router runs it in-process in a client-only app. An async generator `fn` is live: its
 * args add `signal`, `live` is every yield, and `run` takes the first one (`firstYield`). `bearer` is the request's
 * `Authorization: Bearer` token on an API route, `undefined` elsewhere (k.api Bearer). An `output` holding an
 * `s.secret` node throws E1113.
 */
export function loader<T, P = unknown, S = unknown, St = undefined>(
  decl: Decl<T, P, S, St>,
  fn: Fn<T, NoInfer<P>, NoInfer<S>, NoInfer<St>>,
): Loader<T, P, S, St> {
  const { output, params, search, stores } = decl;
  refuseSecret(output);
  return Object.freeze({
    kind: "keel.loader",
    output,
    ...(params === undefined ? {} : { params }),
    ...(search === undefined ? {} : { search }),
    ...(stores === undefined ? {} : { stores }),
    run: (args: RunArgs<P, S, St>, ctx: Ctx) =>
      firstYield((signal) => fn({ ...args, user: args.user ?? "", bearer: args.bearer, signal }, ctx)),
    ...(Reflect.get(fn, Symbol.toStringTag) === "AsyncGeneratorFunction"
      ? {
          live: (a: RunArgs<P, S, St> & { readonly signal: AbortSignal }, ctx: Ctx) =>
            yields(fn({ ...a, user: a.user ?? "", bearer: a.bearer }, ctx)),
        }
      : {}),
  });
}
