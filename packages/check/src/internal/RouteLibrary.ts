/** What `routeComponents` reads of the library holding a file: its package folder, manifest `id` and `public.exports` stems. */
export type RouteLibrary = { readonly folder: string; readonly id: string; readonly exports: ReadonlySet<string> };
