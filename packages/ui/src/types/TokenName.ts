type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Lower = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m";
type Upper = "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";
type Letter = Lower | Upper | Uppercase<Lower | Upper>;

/**
 * The shape of a token name: an identifier (`accent`, `fg-muted`), a one- or two-digit key (`2`, `12`),
 * a decimal key (`1.5`), or a digit-led word (`2xl`). Raw CSS such as `16px` or `#fff` is a type error;
 * whether the name exists in `tokens.ts` is checked by `check` (E1801).
 */
export type TokenName =
  | Digit
  | `${Digit}${Digit}`
  | `${Digit}.${Digit}`
  | `${Digit}${Letter}${string}`
  | `${Letter}${string}`;
