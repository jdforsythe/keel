import { parseTopology } from "../internal/parseTopology.ts";
import { topologyEntry } from "./topologyEntry.ts";

/**
 * The edit k.mount's E1589 fix makes: `servedBy: '<node>'` as the first property of client deployable `name` in
 * `source` (`topology.ts`), when the topology has exactly one `node` deployable and the entry is an object literal.
 */
export function servedByEdit(source: string, name: string): { start: number; end: number; text: string } | undefined {
  const nodes = Object.entries(parseTopology(source).topology).filter(([, d]) => d.adapter === "node");
  const only = nodes.length === 1 ? nodes[0]?.[0] : undefined;
  const at = topologyEntry(source, name);
  if (only === undefined || at.body === undefined) return undefined;
  const text = at.empty === true ? ` servedBy: '${only}' ` : ` servedBy: '${only}',`;
  return { start: at.body, end: at.body, text };
}
