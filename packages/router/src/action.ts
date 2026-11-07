import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result } from "@keel/schema";
import type { Action } from "./types/Action.ts";
import type { Href } from "./types/Href.ts";

type Run<I, P, St> = (
  input: I,
  at: { readonly params: P; readonly url: string; readonly caller: string; readonly stores: St },
  ctx: Ctx,
) => Result<Href | null, KeelError<string, unknown>> | Promise<Result<Href | null, KeelError<string, unknown>>>;

/**
 * Declare a route action (k.server API, RFC 0027): `fn` gets the input decoded by `input`, `{ params, url, caller,
 * stores }`, and `ctx`. `ok(href)` navigates there; `ok(null)` revalidates the current chain. `params` is `Infer` of
 * the declared schema (`unknown` when omitted), which must be the referencing route's own value (`manifest` throws
 * E1507); `fn` is never annotated. `url` is the absolute request URL. `stores` names a server-state factory whose
 * per-request instance `fn` gets (k.server Server state, RFC 0044).
 */
export function action<I, P = unknown, St = undefined>(
  decl: { readonly input: ObjectSchema<I>; readonly params?: ObjectSchema<P>; readonly stores?: (ctx: Ctx) => St },
  fn: Run<I, NoInfer<P>, NoInfer<St>>,
): Action<I, P, St> {
  const { input, params, stores } = decl;
  return Object.freeze({
    kind: "keel.action",
    input,
    ...(params === undefined ? {} : { params }),
    ...(stores === undefined ? {} : { stores }),
    run: fn,
  });
}
