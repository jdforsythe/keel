/** The parsed `base` when it is an absolute `http` or `https` URL with no query, fragment or credentials, else null. */
export function baseUrl(base: string): URL | null {
  if (/[\s"'`\\?#]/.test(base) || !/^https?:\/\/[^/@]+(?:\/|$)/i.test(base)) return null;
  try {
    const u = new URL(base);
    return u.username === "" && u.password === "" && u.hostname !== "" ? u : null;
  } catch {
    return null;
  }
}
