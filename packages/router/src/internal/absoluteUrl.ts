const FALLBACK = "http://localhost/";

/**
 * `path` as an absolute URL (the `url` a loader or action gets, k.server API): resolved against `document.baseURI`, or
 * against `http://localhost/` where the document has no usable base (an `about:blank` test DOM, no DOM at all).
 */
export function absoluteUrl(path: string): string {
  const base = typeof document === "undefined" ? FALLBACK : document.baseURI;
  return new URL(path, URL.canParse(path, base) ? base : FALLBACK).href;
}
