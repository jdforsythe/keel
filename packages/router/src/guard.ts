import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";
import type { ApiGuard } from "./types/ApiGuard.ts";
import type { Guard } from "./types/Guard.ts";

type Fn = (
  req: { readonly url: string; readonly caller: string },
  ctx: Ctx,
) => Promise<Result<null, KeelError<"keel.denied", unknown>>>;

/**
 * Declare a guard (k.guards). Routes hold the returned value in `guard`; it runs outermost first, before any
 * loader. On `err` (`keel.denied`) navigation redirects to route `redirect` of the router's own manifest, with search
 * `{ next: url }`. A guard without `redirect` is an `ApiGuard`: it guards API routes only (k.api), which answer 403 `keel.denied`.
 * There is no name and no registry: the route's reference is the only way to it.
 * `fn` gets `{ url, caller }`: the server's caller id for the request (`""` anonymous), as loaders get it.
 */
export function guard(decl: { readonly redirect: string }, fn: Fn): Guard;
export function guard(decl: Readonly<Record<string, never>>, fn: Fn): ApiGuard;
export function guard(decl: { readonly redirect?: string }, fn: Fn): ApiGuard {
  return Object.freeze({
    kind: "keel.guard",
    ...decl,
    run: (req: { readonly url: string; readonly caller?: string }, ctx: Ctx) =>
      fn({ url: req.url, caller: req.caller ?? "" }, ctx),
  });
}
