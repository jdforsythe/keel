import type { Ctx } from "@keel/ctx";
import type { Infer, Result, Secret } from "@keel/schema";
import type { ApiError } from "./ApiError.ts";

type Flat<T> = { [K in keyof T]: T[K] };
type Part<E, K extends "params" | "query" | "body"> = K extends keyof E
  ? { readonly [P in K]: Infer<E[K]> }
  : Record<never, never>;
type Input<E> = Flat<
  Part<E, "params"> &
    Part<E, "query"> &
    Part<E, "body"> & { readonly signal?: AbortSignal; readonly bearer?: Secret<string>; readonly user?: string }
>;
type Output<E> = E extends { readonly output: infer S } ? Infer<S> : never;
type ErrorBody<E> = E extends { readonly errors: infer M } ? Infer<M[keyof M]> : never;
type Answer<E> = Result<Output<E>, ApiError<ErrorBody<E>>>;

/**
 * The typed client `service(...)` returns: one method per endpoint. A method never throws; failures are `err`. A
 * `bearer` is sent as `authorization: Bearer <token>`; a `user`, as `x-keel-user` signed for a module call (k.user). An
 * `events: true` endpoint's method returns an `AsyncIterable` of results instead of one.
 */
export type Client<D> = {
  readonly [K in keyof D]: (
    input: Input<D[K]>,
    ctx: Ctx,
  ) => D[K] extends { readonly events: true } ? AsyncIterable<Answer<D[K]>> : Promise<Answer<D[K]>>;
};
