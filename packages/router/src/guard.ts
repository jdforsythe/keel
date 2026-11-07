import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";
import type { Guard } from "./types/Guard.ts";

/**
 * Declare a guard (k.router Guards, RFC 0041). Routes hold the returned value in `guard`; it runs outermost first,
 * before any loader. On `err` (`keel.denied`) navigation redirects to route `redirect` of the router's own manifest,
 * with search `{ next: url }`. There is no name and no registry: the route's reference is the only way to it.
 */
export function guard(
  decl: { readonly redirect: string },
  fn: (req: { readonly url: string }, ctx: Ctx) => Promise<Result<null, KeelError<"keel.denied", unknown>>>,
): Guard {
  return Object.freeze({ kind: "keel.guard", redirect: decl.redirect, run: fn });
}
