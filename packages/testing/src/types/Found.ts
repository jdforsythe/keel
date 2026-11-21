import type { JsonValue } from "@keel/schema";
import type { A11yState } from "./A11yState.ts";

/**
 * What `find(id)` returns: a description of the element, never the DOM node. A host element (k.host-element) has
 * `text: ''`, `state: {}` and `value`, its latest value encoded by its `input` schema.
 */
export interface Found {
  readonly id: string;
  readonly role: string;
  readonly name: string;
  readonly text: string;
  readonly state: A11yState;
  readonly value?: JsonValue;
}
