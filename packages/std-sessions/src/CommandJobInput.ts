import type { Manifest, RouteDef } from "@keel/router";

type Table = Manifest<Readonly<Record<string, RouteDef>>>;

/** The job `keel session` writes: which op, the session (JSON), where the result goes, and the deployable's routes. */
export type CommandJobInput = {
  readonly op: "replay" | "minimize" | "to-test";
  readonly session: unknown;
  readonly result: string;
  readonly routes: readonly Table[];
  readonly maxRuns?: number;
  readonly expose?: readonly string[];
  /** The serving modules' `redact` entries, bound on each replay ctx as the recording ctx had them. */
  readonly redact?: readonly string[];
};
