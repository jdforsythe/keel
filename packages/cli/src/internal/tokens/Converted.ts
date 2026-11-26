import type { Item } from "./Item.ts";
import type { Warn } from "./Warn.ts";

/** What one design token becomes: tokens and maybe a look, or a reason it is skipped, with the warnings of its fields. */
export type Converted =
  | { readonly skip: string; readonly warns: readonly Warn[] }
  | {
      readonly items: readonly Item[];
      readonly look?: { readonly name: string; readonly value: Readonly<Record<string, string>> };
      readonly warns: readonly Warn[];
    };
