/** What `keel build` evaluated for the surface: route manifests, the actions bound to their entries, `service` calls. */
export type Evaluated = {
  /** Each routes manifest (project-relative file) with its `routes` export. */
  readonly manifests: readonly { readonly file: string; readonly routes: unknown }[];
  /** The actions `routes.actions()` bound to a route entry, by method (the router's own table). */
  readonly actionsOf: (def: object) => unknown;
  /** Each `service(opts)` call made while the files evaluated, with the project-relative file that made it. */
  readonly services: readonly { readonly file: string; readonly opts: unknown }[];
  /** The stores a `stores` factory creates (`storeShapes` from the evaluated `@keel/store/internal`), else none. */
  readonly storesOf?: (factory: unknown) => unknown;
  /** The content hash of every app source the evaluation read, by project-relative path. */
  readonly sources: Readonly<Record<string, string>>;
};
