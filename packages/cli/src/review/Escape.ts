import type { Danger } from "./Danger.ts";

/** One row of k.escapes: its danger (a declared origin's comes from its directive), opt-in or workaround, what it escapes. */
export type Escape = {
  readonly danger: Danger;
  readonly opt: boolean;
  readonly protection: string;
  readonly message: string;
  /** Read from the range's changes (k.escapes Range codes). */
  readonly range: boolean;
};
