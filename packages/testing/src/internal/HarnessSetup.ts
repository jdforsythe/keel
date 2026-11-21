import type { Ctx } from "@keel/ctx";
import type { CaughtError } from "@keel/runtime-dom";
import type { Snapshot, Store } from "@keel/store";
import type { DocumentNavigation } from "../types/DocumentNavigation.ts";
import type { HarnessArtifacts } from "../types/HarnessArtifacts.ts";
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
  /** The project's artifacts the render checks read (`a11y.json`: E1702; `tokens`: E1804). */
  readonly artifacts: HarnessArtifacts | undefined;
  /** What the render checks record as rendered (a route id or a component name). */
  readonly target: CheckSetup["target"];
  /** A `renderRoute` page: the chain is the document's `main` landmark, and axe judges the document (k.a11y). */
  readonly page?: boolean;
  /** The id of work the DOM does not show while it is in flight (a router navigation's route), else null. */
  readonly busy?: () => string | null;
  /** Extra teardown run by `dispose` after unmounting (a router's `dispose`). */
  readonly teardown?: () => void;
  /** The live stores `state()` and `settle` read (default `stores()`): a fresh module graph's for `resumeDocument`. */
  readonly registry?: () => ReadonlyMap<string, Store<unknown>>;
  /** Where the document navigations the page starts are recorded (`recordDocuments`) until `dispose`. */
  readonly documents?: DocumentNavigation[];
  /** Catches outside the root Boundary that `check()` raises as its own (a router's root alert, `renderRoute`). */
  readonly caught?: CaughtError[];
}
