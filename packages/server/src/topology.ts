import { pathToString } from "@keel/schema";
import { TopologySchema } from "./TopologySchema.ts";
import type { Topology } from "./types/Topology.ts";

/**
 * Validate and freeze a topology definition (k.server). Throws `E1552 ...` when the shape is wrong or a
 * deployable has no modules. Cross-checks (unknown module, one module in two deployables) need the route
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
    out[name] = Object.freeze({ modules: Object.freeze([...d.modules]), adapter: d.adapter });
  }
  return Object.freeze(out);
}
