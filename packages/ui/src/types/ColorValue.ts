/** A color token: one value for both schemes, or a pair chosen by `prefers-color-scheme`. */
export type ColorValue = string | { readonly light: string; readonly dark: string };
