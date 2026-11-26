import type { A11yState } from "./A11yState.ts";

/**
 * What `until(id, match)` waits for (k.e2e-page Verbs): `text` equal to the element's text with white space runs made
 * one space and the ends trimmed, or a `RegExp` it matches; `name` and `role` equal; `state` the given keys equal;
 * `gone: true` no element with that id shown.
 */
export type Match = {
  readonly text?: string | RegExp;
  readonly name?: string;
  readonly role?: string;
  readonly state?: Partial<A11yState>;
  readonly gone?: true;
};
