import type { RunState } from "./RunState.ts";

/** The async context a piece of code runs in: the run it belongs to, and the held work it is inside, if any. */
export interface RunScope {
  readonly state: RunState;
  readonly held: string | undefined;
}
