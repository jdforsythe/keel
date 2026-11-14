/**
 * One piece of evidence for a ledger item (k.ledger): a test outcome, or production use. `runs` and `seed` describe a
 * property run (`property`) or, with `to`, the tally of a `monitored` one; `depth` is an `exhaustive` run's literal
 * `depth`; `z3` the Z3 version a `prove` run's `proven` holds for.
 */
export interface Evidence {
  readonly kind: "example" | "property" | "exhaustive" | "proven" | "monitored";
  readonly passed: boolean;
  readonly runs?: number;
  readonly seed?: number;
  readonly depth?: number;
  readonly to?: number;
  readonly z3?: string;
}
