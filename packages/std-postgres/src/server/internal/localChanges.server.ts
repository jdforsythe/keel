import type { FollowEvent } from "../FollowEvent.ts";
import type { Changes } from "./Changes.ts";

/** Changes one in-process database delivers to its own follows, at `committed`, in commit order. */
export function localChanges(): Changes {
  const follows = new Map<string, Set<(e: FollowEvent) => void>>();
  return {
    async follow(text, on) {
      const set = follows.get(text) ?? new Set();
      follows.set(text, set);
      const own = (e: FollowEvent): void => on(e);
      set.add(own);
      return () => {
        set.delete(own);
        if (set.size === 0 && follows.get(text) === set) follows.delete(text);
      };
    },
    committed(texts) {
      for (const text of texts) for (const on of [...(follows.get(text) ?? [])]) on({ kind: "changed" });
    },
  };
}
