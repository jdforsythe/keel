import type { ColorValue } from "./ColorValue.ts";

type Scale = Readonly<Record<string, string>>;

/**
 * A theme (k.themes Themes): a named, partial set of values for names the top-level groups hold, on by its `when`:
 * `choice` (the default, a visitor's pick), `contrast` (`prefers-contrast: more`) or `print`; an overlay's entry is its
 * value alone.
 */
export type Theme = {
  readonly when?: "choice" | "contrast" | "print";
  readonly color?: Readonly<Record<string, ColorValue>>;
  readonly overlay?: Readonly<Record<string, ColorValue>>;
  readonly space?: Scale;
  readonly size?: Scale;
  readonly radius?: Scale;
  readonly font?: Scale;
  readonly fontSize?: Scale;
  readonly weight?: Scale;
  readonly shadow?: Scale;
  readonly border?: Scale;
};
