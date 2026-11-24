/**
 * What `drive` gives a run: `inRun` runs the scenario in the run's async context, `run` is the scenario's, `failure`
 * a stall, `trace` the entries recorded so far (k.drive Law), `stop` once the scenario is over.
 */
export interface DriveHandle {
  readonly inRun: <T>(fn: () => T) => T;
  readonly run: (ms?: number) => Promise<void>;
  readonly failure: Promise<never>;
  readonly trace: readonly string[];
  /** The label of the first piece of work still pending once the scenario resolved, in creation order, if any. */
  readonly outlived: () => Promise<string | undefined>;
  /** Append the run's final storage and store values to the trace (k.drive Law). */
  readonly finish: () => void;
  readonly stop: () => Promise<void>;
}
