import type { Ctx } from "@keel/ctx";
import type { Infer, Result } from "@keel/schema";
import type { ApiError } from "./ApiError.ts";
import type { EndpointMap } from "./EndpointMap.ts";

type Flat<T> = { [K in keyof T]: T[K] };
type Part<E, K extends "params" | "query" | "body"> = K extends keyof E
  ? { readonly [P in K]: Infer<E[K]> }
  : Record<never, never>;
type Input<E> = Flat<Part<E, "params"> & Part<E, "query"> & Part<E, "body">>;
type Output<E> = E extends { readonly output: infer S } ? Infer<S> : never;
type ErrorBody<E> = E extends { readonly errors: infer M } ? Infer<M[keyof M]> : never;

/** The typed client `service(...)` returns: one method per endpoint. A method never throws; failures are `err`. */
export type Client<D extends EndpointMap> = {
  readonly [K in keyof D]: (input: Input<D[K]>, ctx: Ctx) => Promise<Result<Output<D[K]>, ApiError<ErrorBody<D[K]>>>>;
};
