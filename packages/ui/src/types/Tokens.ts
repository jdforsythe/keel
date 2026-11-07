import type { ColorValue } from "./ColorValue.ts";

type Scale = Readonly<Record<string, string>>;

/** The closed token groups of `tokens.ts` (k.ui). Every group is optional; no other group exists. */
export type Tokens = {
  readonly color?: Readonly<Record<string, ColorValue>>;
  readonly space?: Scale;
  readonly size?: Scale;
  readonly radius?: Scale;
  readonly font?: Scale;
  readonly fontSize?: Scale;
  readonly weight?: Scale;
  readonly shadow?: Scale;
  /** `border` shorthands: `hairline: "1px solid var(--k-color-divider)"`. */
  readonly border?: Scale;
  readonly breakpoint?: Scale;
  readonly motion?: Scale;
};
