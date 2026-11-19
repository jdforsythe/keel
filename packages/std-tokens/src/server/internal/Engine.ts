/** How one mode draws bytes. */
export type Engine = {
  /** True under sim: forms are marked `-sim` and both forms are read. */
  readonly sim: boolean;
  /** `n` fresh bytes (at most 32). */
  bytes(n: number): Buffer;
};
