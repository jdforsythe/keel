import type { Ctx } from "@keel/ctx";
import type { Infer } from "@keel/schema";
import type { Verb } from "./Verb.ts";

type Rec = Readonly<Record<string, unknown>>;
type Parsed<D> = D extends { readonly params: infer X } ? Infer<X> : Record<never, never>;
type Fits<D, A> = A extends { run(input: never, at: { readonly params: infer P }, ctx: Ctx): unknown }
  ? [Parsed<D>] extends [P]
    ? true
    : false
  : true;
type PathId<M> = { [K in keyof M & string]: M[K] extends { readonly path: string } ? K : never }[keyof M & string];
type One<D, R> = {
  readonly [V in keyof R]: V extends Verb
    ? Fits<D, R[V]> extends true
      ? unknown
      : "action params must be Infer<typeof schema> of this route's params"
    : "actions are keyed by POST, PUT, PATCH or DELETE";
};

/**
 * What `routes.actions(a)` requires of `a` beyond `RouteActions` per key (k.router, RFC 0063): each key is a route of
 * the manifest with a `path`, each method key is a `Verb`, and each action's `params` accepts `Infer` of that route's
 * `params` schema (`{}` without one). A key or action that does not fit fails to compile with this message.
 */
export type ActionsFit<M, A> = string extends keyof M
  ? unknown
  : {
      readonly [K in keyof A]: K extends PathId<M>
        ? A[K] extends Rec
          ? One<M[K], A[K]>
          : unknown
        : "not a route with a path in this manifest";
    };
