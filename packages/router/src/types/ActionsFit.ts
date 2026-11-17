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
/** E1512: an API route's action declares `output` and a page's does not (k.api Output). */
type Kind<D, A, K extends string, V extends string> = D extends { readonly api: true }
  ? A extends { readonly output: object }
    ? unknown
    : `E1512 ${K}: an API route's action declares output (${V})`
  : A extends { readonly output: object }
    ? `E1512 ${K}: a page's action declares no output (${V})`
    : unknown;
type PathId<M> = { [K in keyof M & string]: M[K] extends { readonly path: string } ? K : never }[keyof M & string];
type One<D, R, K extends string> = {
  readonly [V in keyof R]: V extends Verb
    ? Fits<D, R[V]> extends true
      ? Kind<D, R[V], K, V>
      : "action params must be Infer<typeof schema> of this route's params"
    : "actions are keyed by POST, PUT, PATCH or DELETE";
};

/**
 * What `routes.actions(a)` requires of `a` beyond `RouteActions` per key (k.router, RFC 0063): each key is a route of
 * the manifest with a `path`, each method key is a `Verb`, and each action's `params` accepts `Infer` of that route's
 * `params` schema (`{}` without one), and an action on an API route declares `output` while one on a page does not
 * (E1512, k.api). A key or action that does not fit fails to compile with this message.
 */
export type ActionsFit<M, A> = string extends keyof M
  ? unknown
  : {
      readonly [K in keyof A]: K extends PathId<M>
        ? A[K] extends Rec
          ? One<M[K], A[K], K>
          : unknown
        : "not a route with a path in this manifest";
    };
