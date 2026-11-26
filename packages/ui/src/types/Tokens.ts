import type { BaseRole } from "./BaseRole.ts";
import type { ColorValue } from "./ColorValue.ts";
import type { Scheme } from "./Scheme.ts";
import type { StyleSet } from "./StyleSet.ts";

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
  /** Default style sets per element role, in the `keel.base` layer; `focus` names the `:focus-visible` ring's color. */
  readonly base?: { readonly [R in BaseRole]?: StyleSet } & { readonly focus?: string };
  /** Named style sets an element takes as `look="<name>"`. */
  readonly look?: Readonly<Record<string, StyleSet>>;
  /** The app's color schemes (k.schemes): `["light"]`, `["dark"]` or `["light", "dark"]`. */
  readonly schemes?: readonly Scheme[];
};
