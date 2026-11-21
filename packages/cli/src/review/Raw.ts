import type { Danger } from "./Danger.ts";

/** One escape a reader found in one file, before its `id` and novelty: `text` is what the `id` hashes (k.escapes). */
export type Raw = {
  readonly code: string;
  readonly line: number;
  readonly col: number;
  readonly text: string;
  readonly reason?: string;
  /** A level above the row's, where k.escapes gives one per finding (an origin's directive, `child_process`). */
  readonly danger?: Danger;
  /** A message naming what was found, when the row's alone is not enough. */
  readonly message?: string;
};
