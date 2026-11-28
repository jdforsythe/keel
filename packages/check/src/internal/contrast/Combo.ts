/**
 * One combination contrast is judged in (k.themes Combinations): its name, its flat values (`color` and `overlay`, no
 * pair), whether the `contrast` theme is on (7:1 for text, k.a11y-static Combinations), whether it is the printed page,
 * its scheme, and the themes on in layer order (`choice`, `contrast`, `print`) for where a library pair lands.
 */
export type Combo = {
  readonly name: string;
  readonly tokens: unknown;
  readonly contrast: boolean;
  readonly printing: boolean;
  readonly scheme: "light" | "dark";
  readonly layers: readonly string[];
};
