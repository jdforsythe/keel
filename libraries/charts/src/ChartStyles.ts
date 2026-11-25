import type { PartStyle } from "@keel/ui/aria";

/**
 * Style props per part of a chart, from the app's tokens. `chart` styles the drawing, which takes its colour from
 * `fg` (marks, lines and labels are drawn in `currentColor`); `summary`, `button` and `table` style the text around it.
 */
export type ChartStyles = {
  readonly chart?: PartStyle;
  readonly summary?: PartStyle;
  readonly button?: PartStyle;
  readonly table?: PartStyle;
};
