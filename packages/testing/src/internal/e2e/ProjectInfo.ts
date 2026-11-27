import type { Deployable } from "./Deployable.ts";

/** What `serve` reads of a project before it starts anything. */
export type ProjectInfo = {
  readonly dir: string;
  /** In `topology.ts` order. */
  readonly deployables: readonly Deployable[];
  /** The keys of `.keel/ids.json`. */
  readonly ids: readonly string[];
  /** Whether `id` is one the project's source can render (readProject.ts). */
  readonly knows: (id: string) => boolean;
};
