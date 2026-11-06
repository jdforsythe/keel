import type { A11yState } from "./A11yState.ts";

/** What `find(id)` returns: a description of the element, never the DOM node. */
export interface Found {
  readonly id: string;
  readonly role: string;
  readonly name: string;
  readonly text: string;
  readonly state: A11yState;
}
