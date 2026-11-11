import { deployDrift } from "@keel/scaffold";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Write } from "../types/Write.ts";

/**
 * The generated deploy files `keel build` writes for the root project (k.topology Deploy files): each Dockerfile,
 * compose file and CI workflow that differs from `deployFiles` of its `topology.ts`, read-only; null removes one no
 * deployable needs.
 */
export function deployBuildWrites(project: readonly SourceFile[]): Write[] {
  const tree = new Map(project.map((f) => [f.path, f.source]));
  return deployDrift(tree, true).map((d) => ({ path: d.path, content: d.want, readonly: true }));
}
