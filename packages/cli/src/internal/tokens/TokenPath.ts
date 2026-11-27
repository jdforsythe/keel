/** A path `keel tokens set` takes: a token, optionally in one scheme, optionally in a theme. */
export type TokenPath = {
  readonly theme?: string;
  readonly group: string;
  readonly name: string;
  readonly scheme?: "light" | "dark";
};
