import type { Change } from "./Change.ts";

/** Read-only access to the git repository a review runs in: paths are git-root paths, revisions commit ids. */
export type GitRepo = {
  /** The git root, an absolute real path. */
  readonly root: string;
  /** The commit `rev` names, or null when it does not resolve to one. */
  readonly commit: (rev: string) => string | null;
  /** Every file of a commit: path to blob id (submodules left out). */
  readonly tree: (commit: string) => ReadonlyMap<string, string>;
  /** The text of each blob, by id. */
  readonly blobs: (ids: readonly string[]) => ReadonlyMap<string, string>;
  /** The changes from `base` to `head`, renames followed. */
  readonly diff: (base: string, head: string) => readonly Change[];
  /** The working tree's tracked and untracked unignored files. */
  readonly files: () => readonly string[];
};
