import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result } from "@keel/schema";
import type { Action } from "./types/Action.ts";
import type { Href } from "./types/Href.ts";

type Run<I, P> = (
  input: I,
  at: { readonly params: P; readonly url: string },
  ctx: Ctx,
) => Result<Href | null, KeelError<string, unknown>> | Promise<Result<Href | null, KeelError<string, unknown>>>;

/**
 * Declare a route action (k.server API, RFC 0027): `fn` gets the input decoded by `input`, `{ params, url }`, and
 * `ctx`. `ok(href)` navigates there; `ok(null)` revalidates the current chain. `params` is `Infer` of the declared
 * schema (`unknown` when omitted), which must be the referencing route's own value (`manifest` throws E1507); `fn`
 * is never annotated. `url` is the absolute request URL.
 */
export function action<I, P = unknown>(
  decl: { readonly input: ObjectSchema<I>; readonly params?: ObjectSchema<P> },
  fn: Run<I, NoInfer<P>>,
): Action<I, P> {
  const { input, params } = decl;
  return Object.freeze({ kind: "keel.action", input, ...(params === undefined ? {} : { params }), run: fn });
}
