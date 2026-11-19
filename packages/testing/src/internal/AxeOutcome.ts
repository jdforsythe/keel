/** One synchronous axe-core run: the rules that reached a verdict, and each failed rule with its elements. */
export interface AxeOutcome {
  /** Rules that passed, failed or did not apply; a rule left `incomplete` or that threw is not run. */
  readonly ran: readonly string[];
  /** Requested rules that threw instead of reaching a verdict. */
  readonly broken: readonly { readonly rule: string; readonly message: string }[];
  readonly failed: readonly { readonly rule: string; readonly help: string; readonly elements: readonly Element[] }[];
}
