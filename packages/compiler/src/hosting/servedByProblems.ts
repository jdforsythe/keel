import type { Topology } from "../types/Topology.ts";

/**
 * The E1566 problems of `topology` (k.hosting Served by), one `[deployable, message]` per bad `servedBy`, in name order:
 * `servedBy` on a deployable that is not `client`, naming an unknown or non-`node` deployable, or naming one another
 * `client` deployable already names. It parses nothing, so a server may import it.
 */
export function servedByProblems(topology: Topology): [string, string][] {
  const out: [string, string][] = [];
  const served = new Map<string, string>();
  for (const name of Object.keys(topology).sort()) {
    const d = topology[name];
    const by = d?.servedBy;
    if (d === undefined || by === undefined) continue;
    const first = served.get(by);
    if (d.adapter !== "client")
      out.push([name, `${name}: servedBy on a ${d.adapter} deployable; only a client names what serves it`]);
    else if (topology[by]?.adapter !== "node") out.push([name, `${name}: servedBy ${by} is not a node deployable`]);
    else if (first !== undefined) out.push([name, `${name}: servedBy ${by} already serves ${first}`]);
    else served.set(by, name);
  }
  return out;
}
