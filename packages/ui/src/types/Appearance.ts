/**
 * A person's pick of scheme and theme (k.schemes Choice), read and set through `appearance(ctx)`: `scheme()` and
 * `theme()` are reactive reads, `set` writes as a pick in `SchemeSelect` or `ThemeSelect` does and returns `true`, or
 * `false` with no change for a theme it does not know or with no document.
 */
export type Appearance = {
  readonly scheme: () => "system" | "light" | "dark";
  readonly theme: () => string;
  readonly set: (pick: { readonly scheme?: "system" | "light" | "dark"; readonly theme?: string }) => boolean;
};
