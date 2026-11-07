import type { Store } from "@keel/store";
import type { Saved } from "./Saved.ts";

/** One factory store of a request: its storage `key`, the copy it was restored `from`, and its snapshot JSON `before` `fn` ran. */
export type Opened = {
  readonly store: Store<unknown>;
  readonly key: string;
  readonly from: Saved;
  readonly before: string;
};
