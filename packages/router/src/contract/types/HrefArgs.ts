import type { Infer } from "@keel/schema";

type None = Readonly<Record<string, never>>;
type InferOr<E, K extends string> = E extends { readonly [P in K]: infer S } ? Infer<S> : None;

/** What `href` takes after a page id (k.router Links): `params` required iff the entry declares them, `search` optional. */
export type HrefArgs<E> = E extends { readonly params: object }
  ? [params: InferOr<E, "params">, search?: InferOr<E, "search">]
  : [params?: None, search?: InferOr<E, "search">];
