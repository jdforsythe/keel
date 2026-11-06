import { pathToString } from "@keel/schema";
import { TopologySchema } from "./TopologySchema.ts";
import type { Topology } from "./types/Topology.ts";

/**
 * Validate and freeze a topology definition (k.server). Throws `E1552 ...` when the shape is wrong, a
 * deployable has no modules, or one module is named in two deployables.
 */
export function topology(def: Topology): Topology {
  const parsed = TopologySchema.parse(def);
  if (!parsed.ok) {
    const first = parsed.error.data.issues[0];
    throw new Error(`E1552 invalid topology${first === undefined ? "" : ` at ${pathToString(first.path)}`}`);
  }
  const owner = new Map<string, string>();
  const out: Record<string, Topology[string]> = {};
  for (const [name, d] of Object.entries(parsed.value)) {
    if (d.modules.length === 0) throw new Error(`E1552 deployable ${name} has no modules`);
    for (const m of d.modules) {
      const prev = owner.get(m);
      if (prev !== undefined) throw new Error(`E1552 module ${m} is in deployables ${prev} and ${name}`);
      owner.set(m, name);
    }
    out[name] = Object.freeze({ modules: Object.freeze([...d.modules]), adapter: d.adapter });
  }
  return Object.freeze(out);
}
