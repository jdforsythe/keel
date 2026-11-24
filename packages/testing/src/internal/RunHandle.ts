import type { Piece } from "./Piece.ts";
/** The run's async context (k.drive Driving), Node only. */
export interface RunHandle {
  /** Call `fn` inside the run's context: its resources are the run's. */
  readonly inRun: <T>(fn: () => T) => T;
  /** Call `start` in the held work's own context, as the work held under `label`; the promise is settled when the drive delivers it. */
  readonly enter: <T>(label: string, start: () => Promise<T>) => Promise<T>;
  /** Report that code made a clock wait: held work that did is `onHeldWait`'s. */
  readonly waited: () => void;
  /**
   * The work of the run that is still pending (resources by Node type, held work by label), in creation order. A
   * resource not yet seen by a garbage collection gets one first, and a resource the collection destroyed is not pending.
   */
  readonly pending: () => readonly Piece[];
  /**
   * Deliver the oldest held work if it has settled and no thread-pool request of the run is in `pending` (k.drive-law
   * Order); true when one was delivered.
   */
  readonly deliver: (pending: readonly Piece[]) => boolean;
  /** End the tracking. */
  readonly stop: () => void;
}
