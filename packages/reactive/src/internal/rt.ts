import type { Node } from "./Node.ts";

/** Engine state shared by every primitive. Single-threaded; one instance per module graph. */
export const rt: {
  /** Computation currently running (reads subscribe it, writes are checked against it). */
  reaction: Node | null;
  /** Owner new primitives register with. */
  owner: Node | null;
  /** Open `batch` depth. */
  depth: number;
  flushing: boolean;
  /** Effects marked stale, waiting for the commit. */
  queue: Node[];
} = { reaction: null, owner: null, depth: 0, flushing: false, queue: [] };
