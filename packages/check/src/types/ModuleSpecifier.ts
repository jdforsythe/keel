/** A module specifier a file names, at the start of the statement or call that names it. */
export interface ModuleSpecifier {
  readonly at: number;
  readonly spec: string;
}
