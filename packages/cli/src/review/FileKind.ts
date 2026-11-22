/** Where a file sits, as k.escapes reads it: each flag decides which rows read the file. */
export type FileKind = {
  /** App code as k.check reads it (E1757's reach). */
  readonly app: boolean;
  /** A test file of k.escapes: `*.test.*`, `*.spec.*`, or under `test/`, `tests/`, `__tests__/`. */
  readonly test: boolean;
  /** Named `*.server.*` or `*.guard.*` (k.boundary's server-only names). */
  readonly server: boolean;
  /** A project file under an `unsafe/` folder. */
  readonly unsafeDir: boolean;
  /** A project's own `topology.ts`. */
  readonly topology: boolean;
};
