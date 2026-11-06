/** Split a URL (root-relative or absolute) into raw `path`, `query` (no "?"), and `hash` (no "#"). */
export function splitUrl(url: string): { readonly path: string; readonly query: string; readonly hash: string } {
  const local = url.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*/, "");
  const h = local.indexOf("#");
  const beforeHash = h < 0 ? local : local.slice(0, h);
  const hash = h < 0 ? "" : local.slice(h + 1);
  const q = beforeHash.indexOf("?");
  const path = q < 0 ? beforeHash : beforeHash.slice(0, q);
  const query = q < 0 ? "" : beforeHash.slice(q + 1);
  return { path: path === "" ? "/" : path, query, hash };
}
