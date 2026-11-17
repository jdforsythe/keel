import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result, Schema, Secret } from "@keel/schema";

/**
 * An API route's action, declared with `action({ input, output, params?, stores? }, fn)` (k.api Output). Its `ok`
 * value is data of `output`'s type, which the server parses before saving the stores and answers as JSON. `run` gets
 * the absolute request `url`, the request's `caller`, its instance of the `stores` factory and `bearer`, the request's
 * `Authorization: Bearer` token (k.api Bearer); a direct call may leave `bearer` out, and `fn` then gets `undefined`.
 */
export interface ApiAction<I, O, P = unknown, St = unknown> {
  readonly kind: "keel.action";
  readonly input: ObjectSchema<I>;
  readonly output: Schema<O>;
  readonly params?: ObjectSchema<P>;
  readonly stores?: (ctx: Ctx) => St;
  run(
    input: I,
    at: {
      readonly params: P;
      readonly url: string;
      readonly caller: string;
      readonly stores: St;
      readonly bearer?: Secret<string>;
    },
    ctx: Ctx,
  ): Result<O, KeelError<string, unknown>> | Promise<Result<O, KeelError<string, unknown>>>;
}
