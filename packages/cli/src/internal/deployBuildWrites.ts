import type { Origins } from "@keel/compiler";
import { type DeployShells, deployDrift } from "@keel/scaffold";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Write } from "../types/Write.ts";

const CI = ".github/workflows/ci.yml";

/**
 * The generated deploy files `keel build` writes for the root project (k.deploy Deploy files): each Dockerfile,
 * compose file, shell file and CI workflow that differs from `deployFiles` of its `topology.ts`, read-only; null removes one no
 * deployable needs. With `ci` (a project that is not an app inside a workspace) the CI workflow is written even when
 * the tree has none yet: the generator keeps a workflow the tree holds, so an empty one stands in for the missing file.
 * `policy` (`shellPolicy`) and `shells` (`shellTargets`) are what the shell targets are given and are;
 * `policy` gives the policy for a deployable's declared origins (k.origins).
 */
export function deployBuildWrites(
  project: readonly SourceFile[],
  ci: boolean,
  policy: ((origins?: Origins) => string) | undefined,
  shells: DeployShells,
): Write[] {
  const tree = new Map(project.map((f) => [f.path, f.source]));
  if (ci && !tree.has(CI)) tree.set(CI, "");
  return deployDrift(tree, true, policy, shells).map((d) => ({ path: d.path, content: d.want, readonly: true }));
}
