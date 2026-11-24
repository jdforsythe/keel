/** A passing `simulate`: the seed it used, how many runs ran, and how many of them the law check replayed and compared (k.drive-law). */
export interface SimulateResult {
  readonly seed: number;
  readonly runs: number;
  readonly checked: number;
}
