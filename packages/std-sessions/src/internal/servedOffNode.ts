import type { Finding, RuleInput } from "@keel/check";
import { parseTopology } from "@keel/compiler";
import { lineCol } from "./lineCol.ts";
import { moduleFile } from "./moduleFile.ts";
import { reachesSource } from "./reachesSource.ts";
import { sourcesOf } from "./sourcesOf.ts";

/**
 * Findings for a module file named one of `files` (`routes.ts`, `runners.server.ts`) that imports or re-exports
 * `target` (directly or through project files, `reachesSource`) when a deployable of the project's `topology.ts`
 * serves that module with an adapter other than `node`: one per declaration leading there, `data` the deployable and
 * its adapter.
 */
export function servedOffNode(
  { file, ast, project }: Pick<RuleInput, "file" | "ast" | "project">,
  files: readonly string[],
  target: string,
): Finding[] {
  const mf = moduleFile(file.path);
  if (mf === undefined || !files.includes(mf.rest)) return [];
  const sources = sourcesOf(ast).filter((s) => reachesSource(project, file.path, s.value, target));
  if (sources.length === 0) return [];
  const topo = project.find((f) => f.path === `${mf.prefix}topology.ts`);
  if (topo === undefined) return [];
  const bad = Object.entries(parseTopology(topo.source).topology).find(
    ([, d]) => d.adapter !== "node" && d.modules.includes(mf.id),
  );
  if (bad === undefined) return [];
  return sources.map((src) => ({
    path: file.path,
    ...lineCol(file.source, src.start),
    data: { deployable: bad[0], adapter: bad[1].adapter },
  }));
}
