/** The page's origin, where the `api` deployable answers (`web` is hosted by `api`); undefined off a browser page. */
export const pageOrigin = (): string | undefined => (typeof location === "undefined" ? undefined : location.origin);
