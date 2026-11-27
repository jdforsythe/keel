import type { A11yNode } from "../../types/A11yNode.ts";
import type { Found } from "../../types/Found.ts";
import type { Layout } from "../../types/Layout.ts";
import type { Violation } from "../Violation.ts";
import type { HeldCheck } from "./HeldCheck.ts";
import type { PageMatch } from "./PageMatch.ts";

/**
 * The functions the page script (`inPage.ts`, bundled and evaluated in each document) leaves on `globalThis`, which the
 * node side calls through Playwright's `evaluate`. Every value crossing is JSON.
 */
export type PageApi = {
  readonly found: (id: string) => Found | null;
  readonly findAll: (prefix: string) => Found[];
  readonly tree: (id: string | null) => A11yNode | null;
  readonly focusOrder: () => string[];
  readonly axe: () => Promise<Violation[]>;
  readonly layout: (id: string | null) => Layout | null;
  readonly style: (id: string | null, names: readonly string[]) => Record<string, string> | null;
  /** Resolves `true` once `match` holds of `id`, re-read on each DOM change; `false` after `ms`. */
  readonly until: (id: string, match: PageMatch, ms: number) => Promise<boolean>;
  /** What `id` shows now, for a wait's message: `text was "…"`, `not shown`, `still shown`. */
  readonly seen: (id: string, match: PageMatch) => string;
  /** Resolves once two animation frames pass with no DOM change; `false` after `ms`. */
  readonly calm: (ms: number) => Promise<boolean>;
  /** How many tabs the page asked to open so far: `window.open` calls and clicks on `target="_blank"` links. */
  readonly opens: () => number;
  readonly hold: (grows: readonly string[]) => void;
  readonly held: () => HeldCheck;
};

declare global {
  // The page script's functions (inPage.ts); absent until it is evaluated in a document.
  var __keelE2e: PageApi | undefined;
  // The context's binding a policy violation is reported through (openContext.ts).
  var __keelProblem: ((kind: string, text: string) => void) | undefined;
}
