import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result } from "@keel/schema";
import type { Href } from "./Href.ts";

/**
 * A route action declared with `action({ input, params? }, fn)` (k.server); `ok(href)` navigates, `ok(null)`
 * revalidates. `run` gets the absolute request `url`. `params` is the declared schema (absent when omitted);
 * `manifest` requires it to be the route's own (E1507) and `P` to accept `Infer` of the route's `params` schema.
 */
export interface Action<I, P = unknown> {
  readonly kind: "keel.action";
  readonly input: ObjectSchema<I>;
  readonly params?: ObjectSchema<P>;
  run(
    input: I,
    at: { readonly params: P; readonly url: string },
    ctx: Ctx,
  ): Result<Href | null, KeelError<string, unknown>> | Promise<Result<Href | null, KeelError<string, unknown>>>;
}
