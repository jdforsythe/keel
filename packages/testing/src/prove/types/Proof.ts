/** What a passing `prove` resolves with: the transactions proven, and the Z3 version the verdict holds for. */
export interface Proof {
  readonly proven: readonly string[];
  readonly z3: string;
}
