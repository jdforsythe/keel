import type { A11yState } from "./A11yState.ts";

/** One addressable element of the a11y tree: role and accessible name per WAI-ARIA, built from the live DOM. */
export interface A11yNode {
  readonly id: string;
  readonly role: string;
  readonly name: string;
  readonly state: A11yState;
  readonly children: readonly A11yNode[];
}
