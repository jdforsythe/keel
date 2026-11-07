import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result } from "@keel/schema";
import type { Href } from "./Href.ts";

/**
 * A route action declared with `action(input, fn)` (k.server); `ok(href)` navigates, `ok(null)` revalidates.
 * `P` is what `fn` declares for `params` (`unknown` when unread); `manifest` requires it to accept `Infer`
 * of the route's `params` schema.
 */
export interface Action<I, P = unknown> {
  readonly kind: "keel.action";
  readonly input: ObjectSchema<I>;
  run(
    input: I,
    at: { readonly params: P },
    ctx: Ctx,
  ): Result<Href | null, KeelError<string, unknown>> | Promise<Result<Href | null, KeelError<string, unknown>>>;
}
