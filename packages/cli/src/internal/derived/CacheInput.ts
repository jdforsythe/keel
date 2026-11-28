/** One recorded input of a cache entry: its path (project-relative, or `<package>/<path in it>`), real file, SHA-256. */
export type CacheInput = { readonly path: string; readonly file: string; readonly sha256: string };
