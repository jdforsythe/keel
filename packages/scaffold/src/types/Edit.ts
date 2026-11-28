/**
 * The complete edit set of one operation: the whole tree after it, and the sorted paths it creates,
 * changes and removes. Applying it is all files or none. `notes` are lines the command prints about a path it
 * writes (`scaffold.note`, k.scaffold Generators).
 */
export type Edit = {
  readonly files: Map<string, string>;
  readonly created: readonly string[];
  readonly changed: readonly string[];
  readonly removed: readonly string[];
  readonly notes?: readonly { readonly path: string; readonly note: string }[];
};
