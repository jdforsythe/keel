import type { BrowserContext, Page as Tab } from "playwright-core";
import type { Problem } from "../../types/Problem.ts";

/** What a test's end needs of one live `serve` (testEnd.ts): its tabs and contexts, records and unread problems. */
export type ServeRun = {
  readonly tabs: () => readonly Tab[];
  readonly contexts: () => readonly BrowserContext[];
  /** The compact records each deployable wrote from the start of the verb that failed, else the last verb. */
  readonly failureRecords: () => readonly string[];
  readonly unread: () => readonly Problem[];
  readonly dispose: () => Promise<void>;
};
