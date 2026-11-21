/** What a review reads (k.review Command): every project, those in scope, and whether a path is in scope. */
export type Scope = {
  /** Every project of the snapshot: git-root folder paths ending `/` (`""` at the root), deepest first. */
  readonly projects: readonly string[];
  /** The projects in scope. */
  readonly chosen: readonly string[];
  readonly has: (path: string) => boolean;
  /** The deepest project holding `path`, or null. */
  readonly projectOf: (path: string) => string | null;
};
