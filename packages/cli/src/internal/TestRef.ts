import type { Evidence } from "@keel/testing";

/** One executed test: the export names it reaches and the evidence it gives (k.testing Ledger). */
export type TestRef = { readonly path: string; readonly names: ReadonlySet<string>; readonly ev: Evidence };
