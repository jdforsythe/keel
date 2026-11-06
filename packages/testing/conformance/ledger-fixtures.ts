// Assumed pure exports from @keel/testing: ledger(items) and ledgerDiff(before, after).
// Assumed input: items = [{ item, evidence: [{ kind: "example" | "property" | "exhaustive" | "proven", passed, runs?, seed? }] }].
export type Ev = {
  readonly kind: "example" | "property" | "exhaustive" | "proven";
  readonly passed: boolean;
  readonly runs?: number;
  readonly seed?: number;
};
export const exampleEv: Ev = { kind: "example", passed: true };
export const propEv: Ev = { kind: "property", passed: true, runs: 100, seed: 1337 };
export const RUNGS = ["none", "example", "probabilistic", "exhaustive", "proven"] as const;
export type Rung = (typeof RUNGS)[number];
