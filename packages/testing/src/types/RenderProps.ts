/**
 * The props `render` takes for a component whose schema gives `P` and which takes `A`: each key of the schema as any
 * value (`render` parses it, `schema.invalid` when it fails), and each callback or slot prop `A` adds beyond the schema
 * with its own type, so a missing one is a type error.
 */
export type RenderProps<P, A extends P> = { readonly [K in keyof P]?: unknown } & Omit<A, keyof P>;
