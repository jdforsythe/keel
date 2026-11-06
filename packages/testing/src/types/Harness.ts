import type { Store } from "@keel/store";
import type { A11yNode } from "./A11yNode.ts";
import type { Found } from "./Found.ts";
import type { TestEvent } from "./TestEvent.ts";

/** A rendered component. Every element is addressed by id; nothing returns a DOM node. */
export interface Harness {
  /** The a11y tree of the render (top-level nodes), or the node with `id`. */
  a11y(): readonly A11yNode[];
  a11y(id: string): A11yNode;
  /** Every live store's value keyed by store id, or one store's value. */
  state(): Readonly<Record<string, unknown>>;
  state<T>(store: Store<T>): T;
  /** Dispatch `event` on the element with `id`; resolves once triggered work has settled. */
  fire(id: string, event: TestEvent): Promise<void>;
  find(id: string): Found;
  /** Unmount and free every binding, listener, and subscription. Idempotent. */
  dispose(): void;
}
