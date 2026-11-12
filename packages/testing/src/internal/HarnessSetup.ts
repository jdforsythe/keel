import type { A11yEntry } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { Snapshot, Store } from "@keel/store";

/**
 * What `render`, `renderRoute` and `resumeDocument` share once inputs are parsed and stores seeded: a `view` to mount,
 * or `start`, which fills the harness container inside the harness scope (disposing the scope ends it).
 */
export type HarnessSetup = Shared &
  ({ readonly view: () => Node } | { readonly start: (container: HTMLElement) => void });

interface Shared {
  readonly ctx: Ctx;
  readonly seeded: readonly (readonly [Store<unknown>, Snapshot<unknown>])[];
  readonly a11y?: Readonly<Record<string, A11yEntry>>;
  /** The id of work the DOM does not show while it is in flight (a router navigation's route), else null. */
  readonly busy?: () => string | null;
  /** Extra teardown run by `dispose` after unmounting (a router's `dispose`). */
  readonly teardown?: () => void;
}
