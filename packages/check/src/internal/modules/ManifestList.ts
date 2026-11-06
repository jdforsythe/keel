import type { Entry } from "./Entry.ts";

/** A literal string array of a manifest: its entries and the array's span (`null` when the field is absent). */
export type ManifestList = {
  readonly entries: readonly Entry[];
  readonly span: { readonly start: number; readonly end: number } | null;
};
