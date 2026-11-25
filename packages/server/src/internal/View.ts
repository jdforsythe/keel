/**
 * One reading of a text the scrub matches (k.privacy Views): `n` code units in `units`, and for each unit the index of
 * the first and of the last character of the raw text's escape it came from (`first`, `last`). The text read as is has
 * no maps: each unit is its own character.
 */
export interface View {
  readonly units: Uint16Array;
  readonly n: number;
  readonly first: Int32Array | undefined;
  readonly last: Int32Array | undefined;
}
