import type { ObservedKind } from "./ObservedKind.ts";

/**
 * What one build-time evaluation's code asked of the file system, the environment and the process as it ran
 * (k.derived Derivation cache), each path absolute as the code named it (relative ones against the process's folder):
 * `reads`, the files it read through `node:fs` or `node:fs/promises`, a file it opened among them, each `.json` file
 * it required and each `package.json` the bundle's resolver read; `probes`, its other questions (`exists`: an
 * existence test; `stat` and `lstat`: a file's kind, size and mode; `realpath`: a real-path lookup or link read, each
 * symbolic link on a path it loaded or read by among them; `list`: a folder listing; `process`: a fact of the process
 * by name, `cwd` always, or `navigator.<name>`; `call`: a call of a recorded built-in, `<module>.<function>:<JSON
 * arguments>`); `env`, each `process.env` name it read, with the value it saw or `null` when absent; `envListed`,
 * whether it listed `process.env`'s names.
 */
export type Observed = {
  readonly reads: readonly string[];
  readonly probes: readonly (readonly [ObservedKind, string])[];
  readonly env: readonly (readonly [string, string | null])[];
  readonly envListed: boolean;
};
