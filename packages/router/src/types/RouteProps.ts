/**
 * What the router passes a route or layout `component`: parsed `params` (a plain value), `search` and the loader's
 * `ok` value as `data` (getters: read in a binding, they follow a kept page's search-only navigation and revalidation;
 * a top-level read is the value at build), and `children` for layouts.
 */
export type RouteProps = {
  readonly params?: unknown;
  readonly search?: unknown;
  readonly data?: unknown;
  /** A layout's page as the default-slot thunk. */
  readonly children?: () => Node;
};
