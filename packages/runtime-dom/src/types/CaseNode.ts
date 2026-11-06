declare const VARIANTS: unique symbol;

/**
 * What `Case` returns: a JSX element (a DOM node) that carries one variant's renderer for `Match`. The
 * phantom `[VARIANTS]` member records the union `U` it belongs to; it never exists at runtime.
 */
export type CaseNode<U> = Node & { readonly [VARIANTS]?: (union: U) => void };
