/**
 * What one rename changes. `names`: declared identifiers and file-name stems (old -> new). `leaf`: a route's
 * leaf name, which is no declared identifier: it follows only in `uses:` list entries, element-id positions,
 * and unresolved import stems. `tokens`: dotted ids (`orders.cart`). `paths`: renamed files (old -> new).
 * `route`: the renamed route's own entry, whose `path` segments equal to the old leaf follow it.
 * `exactAnywhere`: a string equal to an old name is a reference anywhere (PascalCase kinds), else only in
 * `module.ts` manifests.
 */
export type RenameSpec = {
  readonly names: ReadonlyMap<string, string>;
  readonly leaf: readonly [string, string] | null;
  readonly tokens: ReadonlyMap<string, string>;
  readonly paths: ReadonlyMap<string, string>;
  readonly route: { readonly id: string; readonly from: string; readonly to: string } | null;
  readonly exactAnywhere: boolean;
};
