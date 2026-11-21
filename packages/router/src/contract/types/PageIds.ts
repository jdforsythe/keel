/** The page ids of a contract's entries `C`: a `path` and no `method`. */
export type PageIds<C> = {
  [K in keyof C & string]: C[K] extends { readonly method: unknown }
    ? never
    : C[K] extends { readonly path: string }
      ? K
      : never;
}[keyof C & string];
