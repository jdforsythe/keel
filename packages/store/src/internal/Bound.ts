/** A validated, frozen payload and its transaction applied to it. */
export interface Bound<T> {
  readonly payload: unknown;
  readonly apply: (state: T) => T;
  /** With a `.pii()`-marked payload schema: `piiValues` of the payload as given (`givenPiiOf`). */
  readonly given?: readonly string[];
}
