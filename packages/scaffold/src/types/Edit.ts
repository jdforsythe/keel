/**
 * The complete edit set of one operation: the whole tree after it, and the sorted paths it creates,
 * changes and removes. Applying it is all files or none.
 */
export type Edit = {
  readonly files: Map<string, string>;
  readonly created: readonly string[];
  readonly changed: readonly string[];
  readonly removed: readonly string[];
};
