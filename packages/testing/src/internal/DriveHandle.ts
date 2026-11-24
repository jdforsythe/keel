/** What `drive` gives a run: `run` for the scenario, `failure` for a stall, `stop` once the scenario is over. */
export interface DriveHandle {
  readonly run: (ms?: number) => Promise<void>;
  readonly failure: Promise<never>;
  readonly stop: () => Promise<void>;
}
