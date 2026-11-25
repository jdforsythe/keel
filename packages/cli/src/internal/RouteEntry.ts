/**
 * One entry of a project's `.keel/routes.json` (k.compiler Artifacts) as the a11y claims read it: `path` `null` for a
 * layout, `api` for an API entry (k.api), `layout` the id of the layout that wraps it, `module` the module that
 * declares it (the id's first segment when the entry names none).
 */
export type RouteEntry = {
  readonly id: string;
  readonly path: string | null | undefined;
  readonly api: boolean;
  readonly layout: string | undefined;
  readonly module: string;
};
