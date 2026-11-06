/** One test outcome referencing a ledger item. `runs` and `seed` describe a property run. */
export interface Evidence {
  readonly kind: "example" | "property" | "exhaustive" | "proven";
  readonly passed: boolean;
  readonly runs?: number;
  readonly seed?: number;
}
