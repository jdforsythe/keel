/** Binary only: `applyWrites` refused an edit set because a link carries these paths out of the project (k.scaffold Links). */
export class WriteRefused extends Error {
  readonly paths: readonly string[];
  constructor(paths: readonly string[]) {
    super(`refusing to write through a symlink out of the project: ${paths.join(", ")}`);
    this.name = "WriteRefused";
    this.paths = paths;
  }
}
