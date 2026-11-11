import type { Topology } from "@keel/compiler";
import { hostProblems } from "@keel/compiler/hosting/hostProblems";
import { pathToString } from "@keel/schema";
import { TopologySchema } from "./internal/TopologySchema.ts";

/**
 * Validate and freeze a topology definition (k.server). Throws `E1552 ...` when the shape is wrong or a
 * deployable has no modules, and `E1566 ...` for a bad `host` (k.hosting Host, `hostProblems`). Cross-checks (unknown module, one module in two deployables) need the route
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
    if (d.modules.length === 0) throw new Error(`E1552 deployable ${name} has no modules`);
    const modules = Object.freeze([...d.modules]);
    out[name] = Object.freeze(d.host === undefined ? { modules, adapter: d.adapter } : { ...d, modules });
  }
  const bad = hostProblems(out)[0];
  if (bad !== undefined) throw new Error(`E1566 ${bad[1]}`);
  return Object.freeze(out);
}
