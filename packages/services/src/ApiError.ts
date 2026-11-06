import type { KeelError, SchemaError } from "@keel/schema";

type Issues = SchemaError["data"]["issues"];
type Keys = "ms" | "status" | "body" | "issues";
/** Each variant's data also names the other variants' keys as absent, so `error.data.x` reads without narrowing. */
type Data<D> = D & { readonly [K in Exclude<Keys, keyof D>]?: never };

/**
 * Failure of a service call (k.services), matched on `code`. `B` is the union of declared error bodies.
 * `api.timeout`: no response within the timeout. `api.network`: fetch rejected. `api.status`: non-2xx, `body`
 * decoded by `errors[status]` when declared, else null. `api.decode`: a 2xx body (or the call input) fails its schema.
 */
export type ApiError<B = unknown> =
  | KeelError<"api.timeout", Data<{ readonly ms: number }>>
  | KeelError<"api.network", Data<Readonly<Record<never, never>>>>
  | KeelError<"api.status", Data<{ readonly status: number; readonly body: B | null }>>
  | KeelError<"api.decode", Data<{ readonly issues: Issues }>>;
