import type { SourceFile } from "../types/SourceFile.ts";
import type { Write } from "../types/Write.ts";

/** A generated deploy file path: the CI workflow, a Dockerfile, the compose file or a shell file (not `Cargo.lock`). */
const GENERATED =
  /^(?:\.github\/workflows\/ci\.yml|deploy\/(?:[^/]+\/(?:Dockerfile|capacitor\/capacitor\.config\.json|tauri\/(?:tauri\.conf\.json|Cargo\.toml|build\.rs|src\/(?:main|lib)\.rs|capabilities\/default\.json))|compose\.yaml))$/;

/**
 * How many deploy files the build is responsible for: every one `topology.ts` wants, written now or already
 * identical, so the count is the same on every build. `writes` are the `deployBuildWrites` of the same project.
 */
export function deployArtifactCount(project: readonly SourceFile[], writes: readonly Write[]): number {
  const drifted = new Set(writes.map((w) => w.path));
  const wanted = writes.filter((w) => w.content !== null).length;
  return wanted + project.filter((f) => GENERATED.test(f.path) && !drifted.has(f.path)).length;
}
