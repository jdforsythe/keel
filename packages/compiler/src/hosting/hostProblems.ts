import type { Topology } from "../types/Topology.ts";

/**
 * The E1566 problems of `topology` (k.hosting Host), one `[deployable, message]` per bad `host`, in name order:
 * `host` on a deployable that is not `client`, naming an unknown or non-`node` deployable, or naming a host another
 * `client` deployable already names.
 */
export function hostProblems(topology: Topology): [string, string][] {
  const out: [string, string][] = [];
  const served = new Map<string, string>();
  for (const name of Object.keys(topology).sort()) {
    const d = topology[name];
    const host = d?.host;
    if (d === undefined || host === undefined) continue;
    const first = served.get(host);
    if (d.adapter !== "client")
      out.push([name, `${name}: host on a ${d.adapter} deployable; only a client names its host`]);
    else if (topology[host]?.adapter !== "node") out.push([name, `${name}: host ${host} is not a node deployable`]);
    else if (first !== undefined) out.push([name, `${name}: host ${host} already serves ${first}`]);
    else served.set(host, name);
  }
  return out;
}
