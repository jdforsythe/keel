import fs from "node:fs";
import path from "node:path";
import { artifactText } from "./internal/artifactText.ts";
import { evaluateProject } from "./internal/evaluateProject.ts";
import { listSources } from "./internal/listSources.ts";
import { parseTopology } from "./internal/parseTopology.ts";
import { projectManifests } from "./internal/projectManifests.ts";
import { writeArtifact } from "./internal/writeArtifact.ts";

/**
 * Evaluate a project's routes manifests and write `.keel/routes.json` (k.compiler Artifacts, rfc:0059): the
 * evaluation and writer of the Vite plugin's build, for the projects whose own `vite build` never runs (every
 * deployable `node`; `keel build` calls it). The manifests are `projectManifests` of `root`'s `topology.ts` (read
 * statically), placed stdlib modules' `./routes` included. `notes` are Keel-coded lines: evaluation problems
 * (E1006, E1807, ...) and, before a differing file is replaced, `W1005 .keel/routes.json differed from routes.ts; rewritten`. An unchanged file is not rewritten. Rejects
 * when evaluation does (E1000 syntax error, E1049 internal failure).
 */
export async function buildRoutes(root: string): Promise<{ notes: string[] }> {
  const topologyFile = path.join(root, "topology.ts");
  const topology = fs.existsSync(topologyFile)
    ? parseTopology(fs.readFileSync(topologyFile, "utf8")).topology
    : undefined;
  const routesFiles = projectManifests(topology, listSources(root), root);
  const r = await evaluateProject({ root, tokensFile: undefined, routesFiles, usages: [] });
  const notes = r.problems.map((p) => `${p}\n`);
  const next = artifactText(r.routes);
  const prior = path.join(root, ".keel", "routes.json");
  const before = fs.existsSync(prior) ? fs.readFileSync(prior, "utf8") : undefined;
  if (before === next) return { notes };
  if (before !== undefined) notes.push("W1005 .keel/routes.json differed from routes.ts; rewritten\n");
  writeArtifact(root, "routes.json", next);
  return { notes };
}
