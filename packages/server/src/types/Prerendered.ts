/** One document `prerender` rendered: the route id (`undefined` for the not-found document), its path, status and HTML. */
export type Prerendered = {
  readonly id: string | undefined;
  readonly path: string;
  readonly status: number;
  readonly html: string;
};
