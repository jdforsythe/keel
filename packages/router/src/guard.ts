import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Secret } from "@keel/schema";
import { madeFrozen } from "./internal/madeFrozen.ts";
import type { ApiGuard } from "./types/ApiGuard.ts";
import type { Guard } from "./types/Guard.ts";

type Fn = (
  req: {
    readonly url: string;
    readonly caller: string;
    readonly user: string;
    readonly bearer: Secret<string> | undefined;
  },
  ctx: Ctx,
) => Promise<Result<null, KeelError<"keel.denied", unknown>>>;

/**
 * Declare a guard (k.guards). Routes hold the returned value in `guard`; it runs outermost first, before any
 * loader. On `err` (`keel.denied`) navigation redirects to route `redirect` of the router's own manifest, with search
 * `{ next: url }`. A guard without `redirect` is an `ApiGuard`: it guards API routes only (k.api), which answer 403 `keel.denied`.
 * There is no name and no registry: the route's reference is the only way to it.
 * `fn` gets `{ url, caller, user, bearer }`: the server's caller id for the request (`""` anonymous) and its `user`
 * (k.user; `""` for no one), as loaders get them, and
 * the request's `Authorization: Bearer` token on an API route (`undefined` elsewhere; k.api Bearer).
 */
export function guard(decl: { readonly redirect: string }, fn: Fn): Guard;
export function guard(decl: Readonly<Record<string, never>>, fn: Fn): ApiGuard;
export function guard(decl: { readonly redirect?: string }, fn: Fn): ApiGuard {
  return madeFrozen(
    {
      kind: "keel.guard" as const,
      ...decl,
      run: (
        req: {
          readonly url: string;
          readonly caller?: string;
          readonly user?: string;
          readonly bearer?: Secret<string>;
        },
        ctx: Ctx,
      ) => fn({ url: req.url, caller: req.caller ?? "", user: req.user ?? "", bearer: req.bearer }, ctx),
    },
    "guard",
  );
}
