import type { A11yEntry } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { Snapshot, Store } from "@keel/store";

/** What `render` and `renderRoute` share once inputs are parsed and stores seeded. */
export interface HarnessSetup {
  readonly view: () => Node;
  readonly ctx: Ctx;
  readonly seeded: readonly (readonly [Store<unknown>, Snapshot<unknown>])[];
  readonly a11y?: Readonly<Record<string, A11yEntry>>;
  /** True while work the DOM does not show is in flight (a router navigation). */
  readonly busy?: () => boolean;
  /** Extra teardown run by `dispose` after unmounting (a router's `dispose`). */
  readonly teardown?: () => void;
}
