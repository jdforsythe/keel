/** One path segment of a route pattern: literal text or a `:name` param. */
export type Segment =
  | { readonly kind: "static"; readonly text: string }
  | { readonly kind: "param"; readonly name: string };
