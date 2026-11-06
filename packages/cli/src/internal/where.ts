/** `path:line:col`, `path`, or empty when the record has no location. */
export function where(r: { readonly path?: string; readonly line?: number; readonly col?: number }): string {
  if (r.path === undefined) return "";
  return r.line === undefined ? r.path : `${r.path}:${r.line}:${r.col ?? 1}`;
}
