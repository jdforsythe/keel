import type { ApiGuard } from "./ApiGuard.ts";

/**
 * A guard declared with `guard({ redirect }, fn)`; it fits pages, layouts and API routes, which reference the value
 * in `guard`. A guard without `redirect` is an `ApiGuard`.
 */
export interface Guard extends ApiGuard {
  /** Route id of a page to redirect to on denial, with search `{ next: url }`; never an API route (E1508). */
  readonly redirect: string;
}
