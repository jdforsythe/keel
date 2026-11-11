import { HOST_NOT_LITERAL } from "../internal/HOST_NOT_LITERAL.ts";
import { parseTopology } from "../internal/parseTopology.ts";
import type { Topology } from "../types/Topology.ts";

/**
 * The E1566 problems of `topology` (k.hosting Host), one `[deployable, message]` per bad `host`, in name order:
 * `host` on a deployable that is not `client`, naming an unknown or non-`node` deployable, or naming a host another
 * `client` deployable already names; with `source` (the text of `topology.ts`, read statically) first each `host` that is
 * not a string literal.
 */
export function hostProblems(topology: Topology, source?: string): [string, string][] {
  const out: [string, string][] = [];
  for (const p of source === undefined ? [] : parseTopology(source).problems)
    if (p.endsWith(`: ${HOST_NOT_LITERAL}`)) out.push([p.slice(0, -HOST_NOT_LITERAL.length - 2), p]);
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
