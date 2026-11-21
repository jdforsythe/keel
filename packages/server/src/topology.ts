import type { Topology } from "@keel/compiler";
import { deployableNameProblem } from "@keel/compiler/hosting/deployableNameProblem";
import { hostProblems } from "@keel/compiler/hosting/hostProblems";
import { originsProblem } from "@keel/compiler/hosting/originsProblem";
import { pathToString } from "@keel/schema";
import { TopologySchema } from "./internal/TopologySchema.ts";

/**
 * Validate and freeze a topology definition (k.server). Throws `E1552 ...` when the shape is wrong, a deployable
 * name is out of its one form (`deployableNameProblem`) or a deployable has no modules, `E1590 ...` for `origins` out
 * of form (k.origins, `originsProblem`), and `E1566 ...` for a bad `host` (k.hosting Host, `hostProblems`). Cross-checks (unknown module, one module in two deployables) need the route
 * table and run in `createApp`.
 */
export function topology(def: Topology): Topology {
  const parsed = TopologySchema.parse(def);
  if (!parsed.ok) {
    const first = parsed.error.data.issues[0];
    throw new Error(`E1552 invalid topology${first === undefined ? "" : ` at ${pathToString(first.path)}`}`);
  }
  const out: Record<string, Topology[string]> = {};
  for (const [name, d] of Object.entries(parsed.value)) {
    const bad = deployableNameProblem(name);
    if (bad !== undefined) throw new Error(`E1552 ${bad}`);
    if (d.modules.length === 0) throw new Error(`E1552 deployable ${name} has no modules`);
    const origins = originsProblem(name, def[name]?.origins);
    if (origins) throw new Error(origins);
    const modules = Object.freeze([...d.modules]);
    out[name] = Object.freeze({ ...d, modules });
  }
  const host = hostProblems(out)[0];
  if (host !== undefined) throw new Error(`E1566 ${host[1]}`);
  return Object.freeze(out);
}
