/** One entry of a package's `mutation-justified.json` (k.ledger Justified survivors), after its shape is checked. */
export type JustifiedEntry = {
  readonly file: string;
  readonly mutator: string;
  readonly original: string;
  readonly replacement: string;
  readonly reason: string;
  readonly note: string;
};
