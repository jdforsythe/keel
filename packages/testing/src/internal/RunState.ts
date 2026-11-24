/** The resources a run made that are still pending, and whom to tell of a clock wait inside held work. */
export interface RunState {
  /** Pending asynchronous resources made in the run's context other than promises: Node's id, its type. */
  readonly live: Map<number, string>;
  /** Called with the label of held work that made a clock wait. */
  readonly onHeldWait: (label: string) => void;
}
