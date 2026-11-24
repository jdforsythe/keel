import type { StorageReport } from "../StorageReport.ts";

/** What the sim storage objects of one ctx and its replicas share (k.sim Replicas): the data, the step schedule and its counter, and the watches. */
export interface SimShared {
  readonly data: Map<string, string>;
  readonly steps: readonly ("ok" | "fail")[];
  n: number;
  readonly watchers: Set<{ readonly owner: object; readonly on: (report: StorageReport) => void }>;
}
