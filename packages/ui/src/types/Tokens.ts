import type { BaseRole } from "./BaseRole.ts";
import type { ColorValue } from "./ColorValue.ts";
import type { Overlay } from "./Overlay.ts";
import type { StyleSet } from "./StyleSet.ts";
import type { Theme } from "./Theme.ts";

type Scale = Readonly<Record<string, string>>;

/** The closed token groups of `tokens.ts` (k.ui). Every group is optional; no other group exists. */
export type Tokens = {
  readonly color?: Readonly<Record<string, ColorValue>>;
  /** Colors with alpha and the opaque colors each may sit on (k.values Overlays); `bg` and `fg` take their names. */
  readonly overlay?: Readonly<Record<string, Overlay>>;
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
  /** The app's color schemes (k.schemes): `["light"]`, `["dark"]` or `["light", "dark"]`; any other list is E1807. */
  readonly schemes?: readonly string[];
  /** Named themes (k.themes): at most 8 `choice`, one `contrast` and one `print`. */
  readonly themes?: Readonly<Record<string, Theme>>;
};
