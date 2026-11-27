import type { Secret } from "@keel/schema";

/**
 * What a loader's `run` is called with (k.server): the matched `params` and `search` (an API entry's `query`), the
 * absolute request `url`, the request's `caller`, its `user`, `bearer`, `site` (its `Sec-Fetch-Site`) and `host` (its
 * `Host` header; all optional for a direct caller; `fn` then gets `""`, `undefined`, `""` and `""`) and its instance of the `stores` factory. `stores` is optional: absent, `fn` gets
 * what the declared factory returns for the ctx, `undefined` without one.
 */
export type LoaderInput = {
  readonly params: unknown;
  readonly search: unknown;
  readonly url: string;
  readonly caller: string;
  readonly user?: string;
  readonly bearer?: Secret<string> | undefined;
  readonly site?: string;
  readonly host?: string;
  readonly stores?: unknown;
};
