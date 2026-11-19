/** One render-check violation: the rule (an axe-core rule id, or E1702, E1804, E1821), the element, one line of help. */
export interface Violation {
  readonly rule: string;
  /** The element's id, `""` when it has none. */
  readonly element: string;
  /** `<tag id="...">`, for the message. */
  readonly at: string;
  readonly help: string;
}
