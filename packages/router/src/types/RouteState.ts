import type { ObjectSchema } from "@keel/schema";

type None = Readonly<Record<string, never>>;
type ParamsOf<R> = R extends { readonly params: ObjectSchema<infer P> } ? P : None;
type SearchOf<R> = R extends { readonly search: ObjectSchema<infer S> } ? S : None;
type Missing = { readonly id: null; readonly params: None; readonly search: None; readonly pending: boolean };
type Wide = {
  readonly id: string | null;
  readonly params: Readonly<Record<string, unknown>>;
  readonly search: Readonly<Record<string, unknown>>;
  readonly pending: boolean;
};

/**
 * What `route.get()` returns: the current match discriminated by `id` (`null` when no route matched or its
 * params failed). With an untyped table (non-literal keys) it widens to plain records.
 */
export type RouteState<M> = string extends keyof M
  ? Wide
  :
      | {
          [K in keyof M & string]: M[K] extends { readonly path: string }
            ? {
                readonly id: K;
                readonly params: ParamsOf<M[K]>;
                readonly search: SearchOf<M[K]>;
                readonly pending: boolean;
              }
            : never;
        }[keyof M & string]
      | Missing;
