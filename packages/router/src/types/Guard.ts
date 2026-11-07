import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";

/** A guard declared with `guard({ redirect }, fn)`; a route references the value in `guard` (RFC 0041). */
export interface Guard {
  readonly kind: "keel.guard";
  /** Route id to redirect to on denial, with search `{ next: url }`. */
  readonly redirect: string;
  run(req: { readonly url: string }, ctx: Ctx): Promise<Result<null, KeelError<"keel.denied", unknown>>>;
}
