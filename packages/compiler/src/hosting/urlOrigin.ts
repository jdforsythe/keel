/**
 * The origin of a URL text whose authority is known to its end: an `http` or `https` scheme, `//`, and a host
 * followed by `/`, `?` or `#`, or by the end of the text when `whole` (the text is a whole literal, not a template
 * head that may end inside the host); else undefined.
 */
export function urlOrigin(text: string, whole = false): string | undefined {
  const head = (whole ? /^\s*(https?:\/\/[^/?#\s]+)(?:[/?#]|$)/i : /^\s*(https?:\/\/[^/?#\s]+)[/?#]/i).exec(text)?.[1];
  if (head === undefined) return undefined;
  try {
    return new URL(head).origin;
  } catch {
    return undefined;
  }
}
