/** One token name written as a string literal: a token prop's value, a responsive key, or a `look`. */
export type TokenLiteral =
  | { readonly kind: "prop"; readonly prop: string; readonly value: string; readonly at: number }
  | { readonly kind: "breakpoint"; readonly value: string; readonly at: number }
  | { readonly kind: "look"; readonly value: string; readonly at: number };
