/** A widget's name: `label` (written as `aria-label`) or `labelledBy` (an element id), exactly one. */
export type Named =
  | { readonly label: string; readonly labelledBy?: never }
  | { readonly labelledBy: string; readonly label?: never };
