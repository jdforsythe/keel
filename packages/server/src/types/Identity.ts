import type { Ctx } from "@keel/ctx";
import type { RouteTable } from "@keel/router";

/**
 * The project's identity source (k.user), `identity.server.ts`'s default export. `identify` answers who made a request:
 * a user id, `""` for no one; `request` is the incoming `Request` without its body and `caller` the caller it presented.
 * `handle` mounts the endpoints of the library behind it (sign-in, callback, sign-out) at `path` and under it; `fn`'s third
 * argument holds the deployable's `routes`, for `pageHref` to turn a `next` into a 303 `location`.
 */
export type Identity = {
  readonly identify: (args: { readonly request: Request; readonly caller: string }, ctx: Ctx) => Promise<string>;
  readonly handle?: {
    readonly path: string;
    readonly fn: (request: Request, ctx: Ctx, at: { readonly routes: RouteTable }) => Promise<Response> | Response;
  };
};
