import type { BrowserContext } from "playwright-core";
import type { TabState } from "./TabState.ts";

/** A browser context one `open` made (k.e2e Isolation), with its tabs. */
export type ContextRun = { readonly context: BrowserContext; readonly tabs: TabState[] };
