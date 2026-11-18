import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result } from "@keel/schema";
import type { Href } from "./Href.ts";

/**
 * A page's action, declared with `action({ input, params?, stores? }, fn)` (k.server); it declares no `output`
 * (k.api Output). `ok(href)` navigates, `ok(null)` revalidates. `run` gets the absolute request `url`, the request's `caller` and `user` and its instance of the `stores` factory
 * (k.server Server state; `undefined` without one). `params` is the declared schema (absent when omitted);
 * `manifest` requires it to be the route's own (E1507) and `P` to accept `Infer` of the route's `params` schema.
 */
export interface Action<I, P = unknown, St = unknown> {
  readonly kind: "keel.action";
  readonly input: ObjectSchema<I>;
  readonly output?: never;
  readonly params?: ObjectSchema<P>;
  readonly stores?: (ctx: Ctx) => St;
  run(
    input: I,
    at: {
      readonly params: P;
      readonly url: string;
      readonly caller: string;
      readonly user?: string;
      readonly stores: St;
    },
    ctx: Ctx,
  ): Result<Href | null, KeelError<string, unknown>> | Promise<Result<Href | null, KeelError<string, unknown>>>;
}
