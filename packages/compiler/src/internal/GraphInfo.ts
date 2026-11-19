/** What a build tells about one module of its graph. */
export type GraphInfo = {
  readonly isEntry: boolean;
  readonly importedIds: readonly string[];
  readonly dynamicallyImportedIds: readonly string[];
};
