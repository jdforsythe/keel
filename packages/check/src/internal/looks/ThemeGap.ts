/** The names an app theme lacks of a shipped theme (k.themes Library themes): the app's theme, the shipped key, `[group, name]` each. */
export type ThemeGap = {
  readonly theme: string;
  readonly key: "contrast" | "print";
  readonly missing: readonly (readonly [string, string])[];
};
