import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result, Schema } from "@keel/schema";
import type { Loader } from "./types/Loader.ts";

type Run<T, P, S, St> = (
  args: {
    readonly params: P;
    readonly search: S;
    readonly url: string;
    readonly caller: string;
    readonly stores: St;
  },
  ctx: Ctx,
) => Promise<Result<T, KeelError<string, unknown>>>;

/**
 * Declare a route loader (k.server API, RFC 0027): `fn` gets `{ params, search, url, caller, stores }` and `ctx`, and
 * returns a Result whose `ok` value is encoded with `output`. `params`/`search` are `Infer` of the declared schemas
 * (`unknown` when omitted), which must be the referencing route's own values (`manifest` throws E1507); `fn` is never
 * annotated. `url` is the absolute request URL. `stores` names a server-state factory whose per-request instance `fn`
 * gets (k.server Server state, RFC 0044). The router runs it in-process in a client-only app.
 */
export function loader<T, P = unknown, S = unknown, St = undefined>(
  decl: {
    readonly output: Schema<T>;
    readonly params?: ObjectSchema<P>;
    readonly search?: ObjectSchema<S>;
    readonly stores?: (ctx: Ctx) => St;
  },
  fn: Run<T, NoInfer<P>, NoInfer<S>, NoInfer<St>>,
): Loader<T, P, S, St> {
  const { output, params, search, stores } = decl;
  return Object.freeze({
    kind: "keel.loader",
    output,
    ...(params === undefined ? {} : { params }),
    ...(search === undefined ? {} : { search }),
    ...(stores === undefined ? {} : { stores }),
    run: fn,
  });
}
