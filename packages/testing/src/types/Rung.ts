/** Verification rung of a ledger item (docs/TESTING.md); `none` when no passing evidence exists. */
export type Rung = "none" | "monitored" | "example" | "probabilistic" | "exhaustive" | "proven";
