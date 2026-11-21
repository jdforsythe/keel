import type { A11yEntry } from "@keel/compiler";
import type { Tokens } from "@keel/ui";
import type { A11yCheck } from "./A11yCheck.ts";

/** What the render checks of one harness need: the root, whether it is a page, its artifacts, and what it renders. */
export interface CheckSetup {
  readonly root: Element;
  /** A `renderRoute` page: axe judges the document and runs the document rules. */
  readonly page: boolean;
  readonly a11y: Readonly<Record<string, A11yEntry>> | undefined;
  readonly tokens: Tokens | undefined;
  readonly target: () => Pick<A11yCheck, "route" | "component">;
}
