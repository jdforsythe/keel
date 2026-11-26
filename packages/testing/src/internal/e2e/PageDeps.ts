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
};
