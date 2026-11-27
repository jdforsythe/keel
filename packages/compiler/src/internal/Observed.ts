/**
 * What one build-time evaluation's code asked of the file system and the environment as it ran (k.derived Derivation
 * cache), each path absolute as the code named it (relative ones against the process's folder):
 * `reads`, the files it read through `node:fs` or `node:fs/promises`, a file it opened among them, and each `.json`
 * file it required by a computed name; `probes`, its other questions (`exists`: an existence or stat test, `realpath`:
 * a real-path lookup or link read, each symbolic link on a path it loaded or read by among them, `list`: a folder
 * listing); `env`, each `process.env` name it read, with the value it saw or
 * `null` when absent; `envListed`, whether it listed `process.env`'s names.
 */
export type Observed = {
  readonly reads: readonly string[];
  readonly probes: readonly (readonly ["exists" | "realpath" | "list", string])[];
  readonly env: readonly (readonly [string, string | null])[];
  readonly envListed: boolean;
};
