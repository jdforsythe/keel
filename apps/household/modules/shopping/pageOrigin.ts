/** The page's origin, where the list's API and channel answer; undefined while the server renders the page. */
export const pageOrigin = (): string | undefined => (typeof location === "undefined" ? undefined : location.origin);
