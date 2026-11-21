import type { ApiEntry, Contract, Method } from "@keel/router/contract";

type Named<M extends string, E> = {
  readonly [K in keyof E & string as E[K] extends ApiEntry & { readonly method: Exclude<Method, "GET"> }
    ? K extends `${M}.${infer N}`
      ? N
      : never
    : never]: E[K];
};

/** The write entries of contract `C` (std.offline) keyed by their id after the module: what `send` takes by name. A GET, `events` or page entry is not one. */
export type Writes<C extends Contract> = C extends Contract<infer M extends string, infer E> ? Named<M, E> : never;
