import type { Piece } from "./Piece.ts";

/** The work a run made that is still pending, and whom to tell of a clock wait inside held work. */
export interface RunState {
  /**
   * Pending work of the run in creation order: the asynchronous resources made in its context other than promises
   * (Node's id) and the held work (a negative id).
   */
  readonly live: Map<number, Piece>;
  /** Called with the label of held work that made a clock wait. */
  readonly onHeldWait: (label: string) => void;
  /** Set once the run is over: what its context makes after that is nobody's. */
  stopped: boolean;
}
