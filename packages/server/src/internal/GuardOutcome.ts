import type { Failure } from "./Failure.ts";

/** What running a chain's guards decided: proceed, redirect (a denial), or render a failure. */
export type GuardOutcome =
  | { readonly kind: "pass" }
  | { readonly kind: "redirect"; readonly location: string }
  | { readonly kind: "fail"; readonly failure: Failure };
