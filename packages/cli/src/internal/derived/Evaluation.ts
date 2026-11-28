import type { CacheProbe } from "./CacheProbe.ts";

/** What one evaluation of a project gives (`evaluateTree`), data only, so it can cross a process boundary. */
export type Evaluation = {
  /** `routes.json`'s data: each route entry by id. */
  readonly routes: Readonly<Record<string, unknown>>;
  /** The surface's data (k.compat Surface) with each contract's `callers` empty: they are read statically. */
  readonly surface: Readonly<Record<string, unknown>>;
  /** Keel-coded problem lines (E1000, E1006, E1550, E1807, ...), without a trailing newline. */
  readonly problems: readonly string[];
  /** The absolute path of every file the evaluation loaded, sorted. */
  readonly inputs: readonly string[];
  /** The absolute path of every file its code read through `node:fs` or `node:fs/promises`, as the code named it. */
  readonly reads: readonly string[];
  /** Its code's and its resolver's other questions, each with an absolute path, a fact's name or a call (`CacheProbe`). */
  readonly probes: readonly (readonly [Exclude<CacheProbe["kind"], "env" | "env-names">, string])[];
  /** Each `process.env` name its code read, with the value it saw (`null`: absent). */
  readonly env: readonly (readonly [string, string | null])[];
  /** Whether its code listed `process.env`'s names. */
  readonly envListed: boolean;
};
