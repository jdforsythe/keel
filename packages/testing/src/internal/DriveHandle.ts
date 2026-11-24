/**
 * What `drive` gives a run: `inRun` runs the scenario in the run's async context, `run` is the scenario's, `failure`
 * a stall, `trace` the entries recorded so far (k.drive Law), `stop` once the scenario is over.
 */
export interface DriveHandle {
  readonly inRun: <T>(fn: () => T) => T;
  readonly run: (ms?: number) => Promise<void>;
  readonly failure: Promise<never>;
  readonly trace: readonly string[];
  /**
   * Once the scenario resolved: resolves when no work of the run is pending; the budget spent first fails `failure`
   * with E1728 `work outlived the scenario` (k.drive Stalls).
   */
  readonly outlived: () => Promise<void>;
  /** Append the run's final storage and store values to the trace (k.drive Law). */
  readonly finish: () => void;
  readonly stop: () => Promise<void>;
}
