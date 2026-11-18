import type { Harness } from "./Harness.ts";

/** A resumed document (`resumeDocument`): the `render` harness plus what resume took out of the served islands. */
export interface ResumedHarness extends Harness {
  /** How many elements under the served island roots were not in the document when `resumeDocument` resolved. */
  removed(): number;
  /** How many elements under the served island roots were taken out at any time during resume, put back or not. */
  detached(): number;
}
