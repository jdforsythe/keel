/**
 * Whether a shell's `net` may send to `url` (k.shell Origins): an `http:` or `https:` URL whose origin is `origin`'s
 * or, exactly, one of `connect`. Any other scheme, another port or scheme of a listed host, or a URL that does not
 * parse, is not.
 */
export function allows(url: string, origin: URL, connect: readonly string[]): boolean {
  if (!URL.canParse(url)) return false;
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  return u.origin === origin.origin || connect.includes(u.origin);
}
