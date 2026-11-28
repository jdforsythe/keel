import type { Evidence } from "@keel/testing";

/**
 * One executed test (k.ledger): the export names it reaches by name, the `<file>#<name>` exports it reaches through a
 * relative import (`pinned`), the evidence it gives, and the 1-based lines its call spans (`from` to `to`).
 */
export type TestRef = {
  readonly path: string;
  readonly names: ReadonlySet<string>;
  readonly pinned: ReadonlySet<string>;
  readonly ev: Evidence;
  readonly from: number;
  readonly to: number;
};
