/** The parts of a module manifest (k.module) the codemods read. */
export type Manifest = {
  readonly id: string | null;
  readonly deps: readonly string[];
  readonly exports: readonly string[];
};
