/** One library of the app as `keel ledger` reads it (k.library Ledger). */
export type LibraryLedger = {
  readonly name: string;
  /** Its `package.json` `version` ("" when it has none). */
  readonly version: string;
  /** `ledgerCount` summed over its `src/` and `unsafe/` code files: its `libraries` entry. */
  readonly unsafe: number;
  readonly hostElements: number;
  /** The part of those counts the project's own count does not already hold (a file inside the project root). */
  readonly ownUnsafe: number;
  readonly ownHostElements: number;
  /** One per entry of its ledger file's `exports`, in file order, for an installed library whose file holds its shape. */
  readonly records: readonly { readonly item: string; readonly rung: string; readonly evidence: string }[];
};
