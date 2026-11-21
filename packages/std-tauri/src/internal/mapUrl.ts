/**
 * Where a request goes (k.shell): a URL on the page's own origin (`page`, scheme and host) goes to `origin` with its
 * path and search; any other URL goes as given. Compared by scheme and host because `capacitor:` and `tauri:` URLs
 * have an opaque `origin`.
 */
export function mapUrl(
  url: string,
  origin: URL,
  page: { readonly protocol: string; readonly host: string } | undefined,
): string {
  const u = new URL(url);
  return page !== undefined && u.protocol === page.protocol && u.host === page.host
    ? `${origin.origin}${u.pathname}${u.search}`
    : url;
}
