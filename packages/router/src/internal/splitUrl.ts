/** Split a URL (root-relative or absolute) into raw `path`, `query` (no "?"), and `hash` (no "#"). */
export function splitUrl(url: string): { readonly path: string; readonly query: string; readonly hash: string } {
  const local = url.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*/, "");
  const [, path = "", query = "", hash = ""] = /^([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/s.exec(local) ?? [];
  return { path: path === "" ? "/" : path, query, hash };
}
