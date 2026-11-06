import type { Catcher } from "./Catcher.ts";
import type { Root } from "./Root.ts";

/**
 * Runtime ownership record mirroring a reactive scope: what to undo (listeners, handler entries) when
 * the scope goes, the delegation root its handlers register with, and the nearest Boundary.
 */
export interface Owner {
  readonly parent: Owner | null;
  readonly root: Root;
  readonly catcher: Catcher | null;
  readonly children: Set<Owner>;
  readonly cleanups: (() => void)[];
  gone: boolean;
}
