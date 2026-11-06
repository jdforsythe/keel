import type { Computed } from "@keel/reactive";
import type { Responsive } from "./Responsive.ts";
import type { TokenName } from "./TokenName.ts";

type Token<D> = Responsive<TokenName, D>;

/** The style prop vocabulary (k.ui). Values are token names (see `TokenName`); `direction align justify wrap` take keywords and imply flex. */
export type StyleValues<D = Computed<string>> = {
  readonly p?: Token<D>;
  readonly px?: Token<D>;
  readonly py?: Token<D>;
  readonly m?: Token<D>;
  readonly mx?: Token<D>;
  readonly my?: Token<D>;
  readonly gap?: Token<D>;
  readonly w?: Token<D>;
  readonly h?: Token<D>;
  readonly bg?: Token<D>;
  readonly fg?: Token<D>;
  readonly radius?: Token<D>;
  readonly font?: Token<D>;
  readonly fontSize?: Token<D>;
  readonly weight?: Token<D>;
  readonly shadow?: Token<D>;
  readonly direction?: Responsive<"row" | "column" | "row-reverse" | "column-reverse", D>;
  readonly align?: Responsive<"start" | "center" | "end" | "stretch" | "baseline", D>;
  readonly justify?: Responsive<"start" | "center" | "end" | "between" | "around" | "evenly", D>;
  readonly wrap?: Responsive<"wrap" | "nowrap" | "reverse", D>;
};
