import type { Computed } from "@keel/reactive";
import type { TokenName } from "../internal/TokenName.ts";
import type { Responsive } from "./Responsive.ts";

type Space<D> = Responsive<TokenName<"space">, D>;
type Color<D> = Responsive<TokenName<"color">, D>;

/** The style prop vocabulary (k.ui). Values are token names; `direction align justify wrap` imply flex. */
export type StyleValues<D = Computed<string>> = {
  readonly p?: Space<D>;
  readonly px?: Space<D>;
  readonly py?: Space<D>;
  readonly m?: Space<D>;
  readonly mx?: Space<D>;
  readonly my?: Space<D>;
  readonly gap?: Space<D>;
  readonly w?: Responsive<TokenName<"size"> | TokenName<"space">, D>;
  readonly h?: Responsive<TokenName<"size"> | TokenName<"space">, D>;
  readonly bg?: Color<D>;
  readonly fg?: Color<D>;
  readonly radius?: Responsive<TokenName<"radius">, D>;
  readonly font?: Responsive<TokenName<"font">, D>;
  readonly fontSize?: Responsive<TokenName<"fontSize">, D>;
  readonly weight?: Responsive<TokenName<"weight">, D>;
  readonly shadow?: Responsive<TokenName<"shadow">, D>;
  readonly direction?: Responsive<"row" | "column" | "row-reverse" | "column-reverse", D>;
  readonly align?: Responsive<"start" | "center" | "end" | "stretch" | "baseline", D>;
  readonly justify?: Responsive<"start" | "center" | "end" | "between" | "around" | "evenly", D>;
  readonly wrap?: Responsive<"wrap" | "nowrap" | "reverse", D>;
};
