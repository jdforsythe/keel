import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Secret } from "@keel/schema";

/**
 * A guard declared with `guard({}, fn)`, without `redirect`: it fits API routes only (k.api), whose denial answers
 * 403 `keel.denied`. A route references the value in `guard`. Every `Guard` is also an `ApiGuard`.
 */
export interface ApiGuard {
  readonly kind: "keel.guard";
  /** Route id a page's denial redirects to; absent on a guard declared without one. */
  readonly redirect?: string;
  /**
   * `caller`: the request's caller id (k.server; `""` anonymous; the router's `caller` option in a browser or harness).
   * `bearer`: the request's `Authorization: Bearer` token on an API route (k.api Bearer). Both are optional for direct
   * callers (a test calling `run({ url })`); the guard's function then gets `""` and `undefined`.
   */
  run(
    req: { readonly url: string; readonly caller?: string; readonly bearer?: Secret<string> },
    ctx: Ctx,
  ): Promise<Result<null, KeelError<"keel.denied", unknown>>>;
}
