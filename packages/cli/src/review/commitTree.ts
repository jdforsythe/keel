import type { GitRepo } from "./GitRepo.ts";
import type { Snapshot } from "./Snapshot.ts";

/** A commit as a snapshot: its file list, and blob text read in batches (`prefetch`) or one by one. */
export function commitTree(repo: GitRepo, commit: string): Snapshot {
  const tree = repo.tree(commit);
  const texts = new Map<string, string>();
  const read = (ps: readonly string[]): void => {
    const ids = ps.map((p) => tree.get(p)).filter((id): id is string => typeof id === "string" && !texts.has(id));
    for (const [id, t] of repo.blobs(ids)) texts.set(id, t);
  };
  return {
    paths: [...tree.keys()].sort(),
    prefetch: read,
    text: (p) => {
      const id = tree.get(p);
      if (id === undefined) return undefined;
      if (!texts.has(id)) read([p]);
      return texts.get(id);
    },
  };
}
