import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result } from "@keel/schema";
import type { Action } from "./types/Action.ts";
import type { Href } from "./types/Href.ts";

/**
 * Declare a route action (k.server): `fn` gets the input decoded from FormData by `input`, `{ params }`, and
 * `ctx`. `ok(href)` navigates there; `ok(null)` revalidates the current chain. `fn` types `params` as `Infer` of
 * the route's `params` schema; a shape it does not fit fails at `manifest`.
 */
export function action<I, P = unknown>(
  input: ObjectSchema<I>,
  fn: (
    input: I,
    at: { readonly params: P },
    ctx: Ctx,
  ) => Result<Href | null, KeelError<string, unknown>> | Promise<Result<Href | null, KeelError<string, unknown>>>,
): Action<I, P> {
  return Object.freeze({ kind: "keel.action", input, run: fn });
}
