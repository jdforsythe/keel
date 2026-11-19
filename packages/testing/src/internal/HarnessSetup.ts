import type { A11yEntry } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { Snapshot, Store } from "@keel/store";
import type { Tokens } from "@keel/ui";
import type { CheckSetup } from "./CheckSetup.ts";

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
  readonly tokens?: Tokens;
  /** What the render checks record as rendered (a route id or a component name). */
  readonly target: CheckSetup["target"];
  /** A `renderRoute` page: the chain is the document's `main` landmark, and axe judges the document (k.a11y). */
  readonly page?: boolean;
  /** The id of work the DOM does not show while it is in flight (a router navigation's route), else null. */
  readonly busy?: () => string | null;
  /** Extra teardown run by `dispose` after unmounting (a router's `dispose`). */
  readonly teardown?: () => void;
}
