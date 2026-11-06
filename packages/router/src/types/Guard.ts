import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";

/** A named guard declared with `guard(name, { redirect }, fn)`; routes reference it by `name`. */
export interface Guard {
  readonly kind: "keel.guard";
  readonly name: string;
  /** Route id to redirect to on denial, with search `{ next: url }`. */
  readonly redirect: string;
  run(req: { readonly url: string }, ctx: Ctx): Promise<Result<null, KeelError<"keel.denied", unknown>>>;
}
