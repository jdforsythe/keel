/**
 * A URL built by `href()` (k.router). Local stand-in with the router's name and shape until `@keel/router`
 * exports it; replace with `import type { Href } from '@keel/router'` then. String paths are E1501.
 */
export type Href = string & { readonly __brand: "Href" };
