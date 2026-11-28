/**
 * Whether `url` may receive a session from a page of origin `page` (std.sessions E2006): http or https, no user name
 * or password, and the page's own origin, which must not be opaque (`"null"`).
 */
export function uploadable(url: URL, page: string): boolean {
  if (page === "null") return false;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  return url.origin === page;
}
