import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { parseTopology } from "@keel/compiler";
import { lineCol } from "./internal/lineCol.ts";
import { moduleFile } from "./internal/moduleFile.ts";
import { runnersEdits } from "./internal/runnersEdits.ts";
import { runnersFindings } from "./internal/runnersFindings.ts";

/**
 * E2504 (std.jobs, k.check registry): a module with `jobs.server.ts` whose literal `runners` lacks `jobs` (fix adds it,
 * with its import), or that has no `runners.server.ts`, or that a deployable with an adapter other than `node` serves.
 */
export const runnersLackJobs: RuleDef = defineRule({
  code: "E2504",
  see: "std.jobs",
  message: (f) =>
    f.data?.adapter === undefined
      ? "runners lacks jobs; the module's queue never runs"
      : `jobs need a node deployable; '${String(f.data.deployable).slice(0, 24)}' is ${String(f.data.adapter)}`,
  explain:
    "A queue runs where runners.server.ts lists it, in a node deployable. " +
    "Fix: export const runners = [jobs]; place the module in a node deployable.",
  check: ({ file, ast, project }): Finding[] => {
    const out = runnersFindings(file, ast, project, "jobs");
    const mf = moduleFile(file.path);
    const topo = project.find((f) => f.path === `${mf?.prefix}topology.ts`);
    if (mf?.rest !== "jobs.server.ts" || topo === undefined) return out;
    for (const [deployable, d] of Object.entries(parseTopology(topo.source).topology))
      if (d.adapter !== "node" && d.modules.includes(mf.id))
        out.push({ path: file.path, ...lineCol(file.source, 0), data: { deployable, adapter: d.adapter } });
    return out;
  },
  fix: runnersEdits,
});
