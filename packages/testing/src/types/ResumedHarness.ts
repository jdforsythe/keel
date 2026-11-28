import type { Ctx, SimCtx } from "@keel/ctx";
import type { DocumentNavigation } from "./DocumentNavigation.ts";
import type { Harness } from "./Harness.ts";

/** A resumed document (`resumeDocument`): the `render` harness plus what resume took out of the served islands. */
export interface ResumedHarness<C extends Ctx = SimCtx> extends Harness<C> {
  /** How many elements under the served island roots were not in the document when `resumeDocument` resolved. */
  removed(): number;
  /** How many elements under the served island roots were taken out at any time during resume, put back or not. */
  detached(): number;
  /** The document navigations the page started, in order (k.mount Testing); none is made, so the page stays. */
  documents(): readonly DocumentNavigation[];
}
