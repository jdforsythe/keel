/**
 * What one rename changes. `names`: identifiers and file-name stems (old -> new). `tokens`: dotted ids
 * (`orders.cart`). `paths`: renamed files (old -> new path). `route`: the renamed route's own entry, whose
 * `path` segments equal to the old leaf follow it. `exactAnywhere`: a string equal to an old name is a
 * reference anywhere (PascalCase names), else only in `module.ts` manifests.
 */
export type RenameSpec = {
  readonly names: ReadonlyMap<string, string>;
  readonly tokens: ReadonlyMap<string, string>;
  readonly paths: ReadonlyMap<string, string>;
  readonly route: { readonly id: string; readonly from: string; readonly to: string } | null;
  readonly exactAnywhere: boolean;
};
