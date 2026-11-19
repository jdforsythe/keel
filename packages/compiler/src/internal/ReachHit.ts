/** A server-only import E1004 reports: where, what, and the chain from a client entry when one reaches the file. */
export type ReachHit = {
  readonly path: string;
  readonly start: number;
  readonly source: string;
  readonly chain?: string;
};
