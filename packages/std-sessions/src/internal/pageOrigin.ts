/**
 * The document's origin: `self.origin` (opaque in a sandboxed frame or on a `file:` page, where it is `"null"`), else
 * `location.origin`, else `"null"` outside a browser.
 */
export function pageOrigin(): string {
  if (typeof self !== "undefined" && typeof self.origin === "string") return self.origin;
  return typeof location === "undefined" ? "null" : location.origin;
}
