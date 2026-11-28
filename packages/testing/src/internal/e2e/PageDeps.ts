import type { Page as Tab } from "playwright-core";
import type { Page } from "../../types/Page.ts";
import type { ContextRun } from "./ContextRun.ts";
import type { ProjectInfo } from "./ProjectInfo.ts";

/** What a page handle needs of its serve. */
export type PageDeps = {
  readonly project: ProjectInfo;
  /** The deployable origin the tab's paths are under. */
  readonly origin: string;
  readonly run: ContextRun;
  /** Marks the start of a verb, so a failure prints the records from there. */
  readonly verb: () => void;
  /** Keeps the current verb's mark as the failing one. */
  readonly failed: () => void;
  /** A page handle for a tab this context opened by itself (a popup), loaded and quiet. */
  readonly adopt: (tab: Tab) => Promise<Page>;
};
