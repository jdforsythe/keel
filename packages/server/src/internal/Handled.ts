import type { Diag } from "./Diag.ts";

/** A response plus what the dev log stream records about it: the matched route id and diags (E1554). */
export type Handled = {
  readonly response: Response;
  readonly route: string | undefined;
  readonly diags: readonly Diag[];
};
