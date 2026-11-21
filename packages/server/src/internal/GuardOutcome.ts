import type { Diag } from "./Diag.ts";
import type { Failure } from "./Failure.ts";

/** What running a chain's guards decided: proceed, redirect (a denial), or render a failure (E1508 adds a diag). */
export type GuardOutcome =
  | { readonly kind: "pass" }
  | { readonly kind: "redirect"; readonly location: string }
  | { readonly kind: "fail"; readonly failure: Failure; readonly diags: readonly Diag[] };
