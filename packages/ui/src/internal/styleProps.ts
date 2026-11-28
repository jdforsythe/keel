import type { StyleProp } from "../types/StyleProp.ts";
import { USES_BREAKS } from "./USES_BREAKS.ts";

const COMMON: readonly StyleProp[] = [
  "p",
  "px",
  "py",
  "m",
  "mx",
  "my",
  "gap",
  "w",
  "h",
  "bg",
  "fg",
  "radius",
  "font",
  "fontSize",
  "weight",
  "shadow",
  "border",
  "direction",
  "align",
  "justify",
  "wrap",
  "textAlign",
];

/**
 * Every style prop, in the fixed order classes and rules are emitted; the break props last, and only in a build of an
 * app that writes one (`USES_BREAKS`).
 */
export const styleProps: readonly StyleProp[] = USES_BREAKS
  ? [...COMMON, "breakBefore", "breakAfter", "breakInside"]
  : COMMON;
