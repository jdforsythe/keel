/**
 * A URL a `Link` may take. Provisional until `@keel/router` ships `href()`: a branded string, a root-relative
 * path, or an absolute `http`/`https`/`mailto`/`tel` URL. The router's branded `Href` replaces this (E1501).
 */
export type Href =
  | (string & { readonly __brand: "Href" })
  | `/${string}`
  | `${"http" | "https" | "mailto" | "tel"}:${string}`;
