/** The parameters a key is derived at: the form's id names the mode that wrote it. */
type Params = { readonly id: "scrypt" | "scrypt-sim"; readonly ln: number; readonly r: number; readonly p: number };

/** How one mode draws bytes and derives keys. */
export type Engine = {
  /** True under sim: forms are marked `-sim` and both forms are read. */
  readonly sim: boolean;
  /** `n` fresh bytes (at most 32). */
  bytes(n: number): Buffer;
  /** A `length`-byte key, or `null` when the queue is full or the derivation fails. */
  derive(input: Buffer, salt: Buffer, length: number, params: Params): Promise<Buffer | null>;
};
