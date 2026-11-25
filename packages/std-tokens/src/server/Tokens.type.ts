import type { KeelError, Result, Secret } from "@keel/schema";
import type { Digested } from "../Digested.schema.ts";

type Mismatch = KeelError<"credentials.mismatch", Record<string, never>>;
type Expired = KeelError<"credentials.expired", Record<string, never>>;
type Malformed = KeelError<"credentials.malformed", { readonly reason: "format" | "parameters" | "sim" }>;

/** What `tokens(ctx)` gives: opaque tokens minted and checked. No method throws. */
export interface Tokens {
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
  /**
   * The id `check` reads and passes to `find`, so a row can be fetched before `check`. It reads no row, digest or clock:
   * `ok` means well formed, not valid. A value `check` refuses before `find` gets that mismatch. The secret part is never
   * returned.
   */
  idOf(token: Secret<string>): Result<string, Mismatch>;
  /** The row `find` returns for the token's id, when the token matches its digest and has not expired. */
  check<R extends { readonly digest: Digested }>(
    token: Secret<string>,
    find: (id: string) => R | undefined,
  ): Result<R, Mismatch | Expired | Malformed>;
}
