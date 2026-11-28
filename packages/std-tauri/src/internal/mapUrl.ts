/**
 * Where a request goes (k.shell): a URL on the page's own origin (`page`, scheme and host) goes to `origin` with its
 * path and search, and with no `origin` (k.shell Without a server) nowhere: undefined, which the driver refuses; any
 * other URL goes as given. Compared by scheme and host because `capacitor:` and `tauri:` URLs
 * have an opaque `origin`.
 */
export function mapUrl(
  url: string,
  origin: URL | undefined,
  page: { readonly protocol: string; readonly host: string } | undefined,
): string | undefined {
  const u = new URL(url);
  if (page === undefined || u.protocol !== page.protocol || u.host !== page.host) return url;
  return origin === undefined ? undefined : `${origin.origin}${u.pathname}${u.search}`;
}
