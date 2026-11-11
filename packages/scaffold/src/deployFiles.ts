import { ciWorkflow } from "./templates/ciWorkflow.ts";
import { composeYaml } from "./templates/composeYaml.ts";
import { dockerfile } from "./templates/dockerfile.ts";
import type { DeployTopology } from "./types/DeployTopology.ts";

/**
 * The generated deploy files of a project (k.topology Deploy files), path -> text in path order:
 * `deploy/<name>/Dockerfile` per `node` deployable and `deploy/compose.yaml` when there is one, plus
 * `.github/workflows/ci.yml` when `project.ci` (a project outside the Keel monorepo). Pure; equal input gives
 * byte-identical output, whatever the order of deployables or modules in `topology`.
 */
export function deployFiles(topology: DeployTopology, project: { readonly ci: boolean }): Map<string, string> {
  const nodes = Object.keys(topology)
    .filter((n) => topology[n]?.adapter === "node")
    .sort();
  const out = new Map<string, string>();
  if (project.ci) out.set(".github/workflows/ci.yml", ciWorkflow(topology));
  if (nodes.length > 0) out.set("deploy/compose.yaml", composeYaml(nodes));
  for (const n of nodes) out.set(`deploy/${n}/Dockerfile`, dockerfile(n));
  return out;
}
