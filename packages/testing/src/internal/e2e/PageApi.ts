import type { A11yNode } from "../../types/A11yNode.ts";
import type { Found } from "../../types/Found.ts";
import type { Layout } from "../../types/Layout.ts";
import type { Violation } from "../Violation.ts";

/** A `Match` as it crosses into the page: a `RegExp` as its source and flags. */
export type PageMatch = {
  readonly text?: string;
  readonly pattern?: { readonly source: string; readonly flags: string };
  readonly name?: string;
  readonly role?: string;
  readonly state?: Readonly<Record<string, unknown>>;
  readonly gone?: true;
};

/** What a held page looked like before its scripts ran, as `resume` compares it. */
export type HeldCheck = { readonly ok: true } | { readonly ok: false; readonly why: string };

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
  readonly style: (id: string, names: readonly string[]) => Record<string, string> | null;
  /** Resolves `true` once `match` holds of `id`, re-read on each DOM change; `false` after `ms`. */
  readonly until: (id: string, match: PageMatch, ms: number) => Promise<boolean>;
  /** What `id` shows now, for a wait's message: `text was "…"`, `not shown`, `still shown`. */
  readonly seen: (id: string, match: PageMatch) => string;
  /** Resolves once an animation frame passes with no DOM change; `false` after `ms`. */
  readonly calm: (ms: number) => Promise<boolean>;
  readonly hold: () => void;
  readonly held: () => HeldCheck;
};

declare global {
  // The page script's functions (inPage.ts); absent until it is evaluated in a document.
  var __keelE2e: PageApi | undefined;
}
