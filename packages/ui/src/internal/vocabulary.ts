import type { StyleProp } from "../types/StyleProp.ts";
import type { TokenGroup } from "../types/TokenGroup.ts";

type Entry = {
  /** Token groups searched in order for the value (empty for keyword props). */
  readonly groups: readonly TokenGroup[];
  /** Closed keyword -> CSS value map (empty for token props). */
  readonly keywords: Readonly<Record<string, string>>;
  readonly property: string;
  /** The prop implies `display: flex`. */
  readonly flex: boolean;
};

const token = (property: string, ...groups: TokenGroup[]): Entry => ({ groups, keywords: {}, property, flex: false });
const flex = (property: string, keywords: Readonly<Record<string, string>>): Entry => ({
  groups: [],
  keywords,
  property,
  flex: true,
});

/** Style prop -> CSS. `w`/`h` take `size` tokens, then `space` tokens. */
export const vocabulary: Readonly<Record<StyleProp, Entry>> = {
  p: token("padding", "space"),
  px: token("padding-inline", "space"),
  py: token("padding-block", "space"),
  m: token("margin", "space"),
  mx: token("margin-inline", "space"),
  my: token("margin-block", "space"),
  gap: token("gap", "space"),
  w: token("width", "size", "space"),
  h: token("height", "size", "space"),
  bg: token("background-color", "color"),
  fg: token("color", "color"),
  radius: token("border-radius", "radius"),
  font: token("font-family", "font"),
  fontSize: token("font-size", "fontSize"),
  weight: token("font-weight", "weight"),
  shadow: token("box-shadow", "shadow"),
  direction: flex("flex-direction", {
    row: "row",
    column: "column",
    "row-reverse": "row-reverse",
    "column-reverse": "column-reverse",
  }),
  align: flex("align-items", {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    stretch: "stretch",
    baseline: "baseline",
  }),
  justify: flex("justify-content", {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    between: "space-between",
    around: "space-around",
    evenly: "space-evenly",
  }),
  wrap: flex("flex-wrap", { wrap: "wrap", nowrap: "nowrap", reverse: "wrap-reverse" }),
};
