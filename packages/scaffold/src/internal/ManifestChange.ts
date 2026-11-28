/** Additions and removals to apply to one module manifest. */
export type ManifestChange = {
  addDeps: Set<string>;
  removeDeps: Set<string>;
  addExports: Set<string>;
  removeExports: Set<string>;
};
