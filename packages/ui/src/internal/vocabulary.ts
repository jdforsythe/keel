import type { StyleProp } from "../types/StyleProp.ts";
import type { TokenGroup } from "../types/TokenGroup.ts";

type Entry = {
  /** Token groups searched in order for the value (empty for keyword props). */
  readonly groups: readonly TokenGroup[];
  /** Closed keyword -> CSS value map (empty for token props). */
  readonly keywords: Readonly<Record<string, string>>;
  readonly property: string;
  /** Declarations written before the property: the flex props imply `display:flex`, the sizes `border-box`. */
  readonly lead: string;
};

const token = (property: string, ...groups: TokenGroup[]): Entry => ({ groups, keywords: {}, property, lead: "" });
/** A size counts its padding and border, so `w="full"` with `px` and `border` fits its container. */
const size = (property: string, ...groups: TokenGroup[]): Entry => ({
  groups,
  keywords: {},
  property,
  lead: "box-sizing:border-box;",
});
const flex = (property: string, keywords: Readonly<Record<string, string>>): Entry => ({
  groups: [],
  keywords,
  property,
  lead: "display:flex;",
});

const text = (property: string, keywords: Readonly<Record<string, string>>): Entry => ({
  groups: [],
  keywords,
  property,
  lead: "",
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
  w: size("width", "size", "space"),
  h: size("height", "size", "space"),
  bg: token("background-color", "color", "overlay"),
  fg: token("color", "color", "overlay"),
  radius: token("border-radius", "radius"),
  font: token("font-family", "font"),
  fontSize: token("font-size", "fontSize"),
  weight: token("font-weight", "weight"),
  shadow: token("box-shadow", "shadow"),
  border: token("border", "border"),
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
  textAlign: text("text-align", { start: "start", center: "center", end: "end" }),
  breakBefore: text("break-before", { page: "page", avoid: "avoid" }),
  breakAfter: text("break-after", { page: "page", avoid: "avoid" }),
  breakInside: text("break-inside", { avoid: "avoid" }),
};
