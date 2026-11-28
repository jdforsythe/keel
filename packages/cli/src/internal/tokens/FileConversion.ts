import type { Item } from "./Item.ts";
import type { Warn } from "./Warn.ts";

/** A design tokens file as the importer converts it: the tokens and looks it gives in order, and its warnings. */
export type FileConversion = {
  readonly items: readonly Item[];
  readonly looks: readonly { readonly name: string; readonly value: Readonly<Record<string, string>> }[];
  readonly warns: readonly Warn[];
};
