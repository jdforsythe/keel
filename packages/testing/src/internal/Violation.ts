/** One structural accessibility violation (axe-like rule id, offending element, one-line help). */
export interface Violation {
  readonly rule: "image-alt" | "button-name" | "link-name" | "label" | "landmark-unique";
  readonly at: string;
  readonly help: string;
}
