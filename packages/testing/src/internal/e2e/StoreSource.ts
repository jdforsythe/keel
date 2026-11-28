/** Where a deployable's storage keeps a store (k.e2e Served `state`): a file `serve` made, or the URL `env` gave. */
export type StoreSource =
  | { readonly kind: "sqlite"; readonly file: string }
  | { readonly kind: "file"; readonly file: string }
  | { readonly kind: "postgres"; readonly url: string; readonly project: string };
