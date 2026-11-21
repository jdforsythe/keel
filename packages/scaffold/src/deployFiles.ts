import type { Origins } from "@keel/compiler";
import { shellApps } from "./internal/shellApps.ts";
import { ciWorkflow } from "./templates/ciWorkflow.ts";
import { composeYaml } from "./templates/composeYaml.ts";
import { dockerfile } from "./templates/dockerfile.ts";
import type { DeployShells } from "./types/DeployShells.ts";
import type { DeployTopology } from "./types/DeployTopology.ts";

/**
 * The generated deploy files of a project (k.deploy Deploy files, k.shell Files), path -> text:
 * `deploy/<name>/Dockerfile` per `node` deployable (per its `storage`) and `deploy/compose.yaml` when there is one;
 * per `client` deployable declaring a shell whose target is in `project.shells`, that target's `files` under
 * `deploy/<name>/<shell>/`; plus `.github/workflows/ci.yml` when `project.ci` (a project outside the Keel monorepo),
 * with each target's CI jobs. `project.version` is the app's `package.json` version (default `0.0.0`), `project.pkg`
 * its name, `project.policy` gives the content security policy
 * for a deployable's declared `origins` (k.origins), `project.identity` whether the project has
 * `identity.ts`: what each shell target is given (`ShellApp`). Pure; equal input gives byte-identical output, whatever
 * the order of deployables or modules in `topology`.
 */
export function deployFiles(
  topology: DeployTopology,
  project: {
    readonly ci: boolean;
    readonly version?: string | undefined;
    readonly pkg?: string | undefined;
    readonly policy?: ((origins?: Origins) => string) | undefined;
    readonly identity?: boolean | undefined;
    readonly shells?: DeployShells | undefined;
  },
): Map<string, string> {
  const names = Object.keys(topology).sort();
  const nodes = names.filter((n) => topology[n]?.adapter === "node");
  const shells = project.shells ?? {};
  const shared = {
    version: project.version ?? "0.0.0",
    pkg: project.pkg ?? "",
    policy: project.policy,
    identity: project.identity === true,
  };
  const files: [string, string][] = [];
  if (project.ci) files.push([".github/workflows/ci.yml", ciWorkflow(topology, shells, shared)]);
  if (nodes.length > 0) files.push(["deploy/compose.yaml", composeYaml(nodes, (n) => topology[n]?.storage ?? "file")]);
  for (const n of nodes) files.push([`deploy/${n}/Dockerfile`, dockerfile(n, topology[n]?.storage ?? "file")]);
  for (const { shell, app } of shellApps(topology, shared)) {
    const given = shells[shell]?.files(app) ?? {};
    for (const [p, text] of Object.entries(given)) files.push([`deploy/${app.deployable}/${shell}/${p}`, text]);
  }
  return new Map(files);
}
