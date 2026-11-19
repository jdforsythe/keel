import type { KeelError, Result, Secret } from "@keel/schema";
import type { Digested } from "../Digested.ts";
import type { Hashed } from "../Hashed.ts";

type Busy = KeelError<"keel.busy", { readonly limit: number }>;
type Mismatch = KeelError<"credentials.mismatch", Record<string, never>>;
type Expired = KeelError<"credentials.expired", Record<string, never>>;
type Malformed = KeelError<"credentials.malformed", { readonly reason: "format" | "parameters" | "sim" }>;

/** What `credentials(ctx)` gives: password hashes (std.credentials) and tokens (std.tokens). No method throws. */
export interface Hasher {
  /** A new `Hashed` with a fresh salt at the ctx's cost. */
  hash(
    secret: Secret<string>,
  ): Promise<Result<Hashed, KeelError<"credentials.length", { readonly min: 1; readonly max: 1024 }> | Busy>>;
  /** `ok({ rehash })` only when `secret` matches `stored`; `rehash` when `stored` is below the ctx's cost. */
  verify(
    secret: Secret<string>,
    stored: Hashed | undefined,
  ): Promise<Result<{ readonly rehash: boolean }, Mismatch | Malformed | Busy>>;
  /** A new token, its `id`, the `digest` to store with the expiry inside, and `expiresAt`. */
  mint(options: { readonly ttl: number | null }): Result<
    {
      readonly token: Secret<string>;
      readonly id: string;
      readonly digest: Digested;
      readonly expiresAt: number | null;
    },
    KeelError<"credentials.ttl", { readonly min: 60000; readonly max: 31536000000 }>
  >;
  /** The row `find` returns for the token's id, when the token matches its digest and has not expired. */
  check<R extends { readonly digest: Digested }>(
    token: Secret<string>,
    find: (id: string) => R | undefined,
  ): Result<R, Mismatch | Expired | Malformed>;
}
