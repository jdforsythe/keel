import type { KeelError } from "@keel/schema";
import type { ApiError } from "@keel/services";

/**
 * What `send` resolves (std.offline): `sent` with the endpoint's output, `queued` (offline, or the network failed),
 * `conflict` with the head that refused the write, or `failed` with its `ApiError`, `offline.full`, or
 * `offline.storage` (a write to `ctx.storage` rejected while flushing).
 */
export type OutboxResult<O> =
  | { readonly state: "sent"; readonly value: O }
  | { readonly state: "queued" }
  | { readonly state: "conflict"; readonly head: number }
  | {
      readonly state: "failed";
      readonly error:
        | ApiError
        | KeelError<"offline.full", { readonly limit: number; readonly maxBytes: number }>
        | KeelError<"offline.storage", Readonly<Record<string, never>>>;
    };
