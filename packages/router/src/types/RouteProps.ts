/**
 * What the router passes a route or layout `component`: parsed `params` and `search`, the loader's `ok`
 * value as `data` (a getter: reading it inside a binding tracks revalidation), and `children` for layouts.
 */
export type RouteProps = {
  readonly params?: unknown;
  readonly search?: unknown;
  readonly data?: unknown;
  /** A layout's page as the default-slot thunk (RFC 0008). */
  readonly children?: () => Node;
};
