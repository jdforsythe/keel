import type { TokenGroup } from "../types/TokenGroup.ts";

/** The closed token groups, in the order custom properties are emitted. */
export const tokenGroups: readonly TokenGroup[] = [
  "color",
  "space",
  "size",
  "radius",
  "font",
  "fontSize",
  "weight",
  "shadow",
  "breakpoint",
  "motion",
];
