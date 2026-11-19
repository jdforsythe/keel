import type { ReplayGroupResult } from "@keel/std-sessions/group";
import type { RaceReport } from "./RaceReport.ts";

/** What `findRaces` returns: the `replayGroup` result and the races of every checked server store. */
export interface FindRacesResult extends RaceReport {
  readonly replay: ReplayGroupResult;
}
