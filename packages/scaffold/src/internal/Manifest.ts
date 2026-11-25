/** The parts of a module manifest (k.module) the codemods read. */
export type Manifest = {
  readonly id: string | null;
  readonly deps: readonly string[];
  readonly exports: readonly string[];
  /** The environment variables its server code reads (k.server-deps Environment). */
  readonly env: readonly string[];
};
