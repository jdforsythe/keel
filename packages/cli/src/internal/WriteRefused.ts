/** Binary only: `applyWrites` refused an edit set because these paths lead out of the project through a symlink. */
export class WriteRefused extends Error {
  readonly paths: readonly string[];
  constructor(paths: readonly string[]) {
    super(`refusing to write through a symlink out of the project: ${paths.join(", ")}`);
    this.name = "WriteRefused";
    this.paths = paths;
  }
}
