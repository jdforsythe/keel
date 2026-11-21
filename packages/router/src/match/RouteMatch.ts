/** What `matchHref` returns for an href a path route matches: its id and its decoded params and search (k.router). */
export type RouteMatch = {
  readonly id: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly search: Readonly<Record<string, unknown>>;
};
