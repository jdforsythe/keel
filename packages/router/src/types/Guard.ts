import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";

/** A guard declared with `guard({ redirect? }, fn)`; a route references the value in `guard`. */
export interface Guard {
  readonly kind: "keel.guard";
  /**
   * Route id to redirect to on denial, with search `{ next: url }`. Without one the guard guards API routes only (k.api):
   * a page or layout needs a guard with `redirect` (E1508).
   */
  readonly redirect?: string;
  /**
   * `caller`: the request's caller id (k.server; `""` anonymous; the router's `caller` option in a browser or harness).
   * Optional for direct callers (a test calling `run({ url })`); the guard's function then gets `""`.
   */
  run(
    req: { readonly url: string; readonly caller?: string },
    ctx: Ctx,
  ): Promise<Result<null, KeelError<"keel.denied", unknown>>>;
}
