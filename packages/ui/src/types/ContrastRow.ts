/** One `contrastTable` entry: text token `fg` on background token `bg` in `scheme`, WCAG ratio to two decimals. */
export interface ContrastRow {
  readonly scheme: "light" | "dark";
  readonly fg: string;
  readonly bg: string;
  readonly ratio: number;
}
