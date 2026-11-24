import type { Piece } from "./Piece.ts";
/** The run's async context (k.drive Driving), Node only. */
export interface RunHandle {
  /** Call `fn` inside the run's context: its resources are the run's. */
  readonly inRun: <T>(fn: () => T) => T;
  /** Call `start` inside the run's context, as the work held under `label`. */
  readonly enter: <T>(label: string, start: () => Promise<T>) => Promise<T>;
  /** Report that code made a clock wait: held work that did is `onHeldWait`'s. */
  readonly waited: () => void;
  /** The work of the run that is still pending (resources by Node type, held work by label), in creation order. */
  readonly pending: () => readonly Piece[];
  /** End the tracking. */
  readonly stop: () => void;
}
