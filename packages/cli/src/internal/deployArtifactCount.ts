import type { SourceFile } from "../types/SourceFile.ts";
import type { Write } from "../types/Write.ts";

/** A generated deploy file path outside the shell folders: the CI workflow, a Dockerfile or the compose file. */
const GENERATED = /^(?:\.github\/workflows\/ci\.yml|deploy\/(?:[^/]+\/Dockerfile|compose\.yaml))$/;

/**
 * How many deploy files the build is responsible for: every one `topology.ts` wants, written now or already
 * identical, so the count is the same on every build. `writes` are the `deployBuildWrites` of the same project,
 * `shells` the shell file paths the shell targets give (`shellTargets`).
 */
export function deployArtifactCount(
  project: readonly SourceFile[],
  writes: readonly Write[],
  shells: ReadonlySet<string>,
): number {
  const drifted = new Set(writes.map((w) => w.path));
  const wanted = writes.filter((w) => w.content !== null).length;
  return wanted + project.filter((f) => (GENERATED.test(f.path) || shells.has(f.path)) && !drifted.has(f.path)).length;
}
