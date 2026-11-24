import type { RouteTable } from "@keel/router";
import type { ReplayOptions } from "./ReplayOptions.ts";

/** The job `keel session` writes: which op, the session (JSON), where the result goes, and the deployable's routes (every placed module's with `serve`). */
export type CommandJobInput = {
  readonly op: "replay" | "minimize" | "to-test";
  readonly session: unknown;
  readonly result: string;
  readonly routes: readonly RouteTable[];
  readonly maxRuns?: number;
  readonly expose?: readonly string[];
  /** The serving modules' `redact` entries, bound on each replay ctx as the recording ctx had them. */
  readonly redact?: readonly string[];
  /** Resolves the app of the `node` deployable serving the session's route over the job's ctx (`replay`'s `serve`). */
  readonly serve?: ReplayOptions["serve"];
  /** The id the base renders signed in as (`--user`). */
  readonly user?: string;
};
