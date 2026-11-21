import type { RouteTable } from "@keel/router";

/** The job `keel session` writes: which op, the session (JSON), where the result goes, and the deployable's routes. */
export type CommandJobInput = {
  readonly op: "replay" | "minimize" | "to-test";
  readonly session: unknown;
  readonly result: string;
  readonly routes: readonly RouteTable[];
  readonly maxRuns?: number;
  readonly expose?: readonly string[];
  /** The serving modules' `redact` entries, bound on each replay ctx as the recording ctx had them. */
  readonly redact?: readonly string[];
};
