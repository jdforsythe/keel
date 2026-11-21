import type { Topology } from "../types/Topology.ts";

/**
 * The build error for an `entry` no deployable serves, naming the fix: with `want` (`?d=` or `KEEL_DEPLOYABLE`) naming
 * none, the names it may take; else a `client` or `static` deployable to add to `topology.ts`.
 */
export function noDeployable(entry: string, topology: Topology | undefined, want: string | undefined): string {
  const names = Object.keys(topology ?? {}).sort();
  if (want !== undefined && names.length > 0)
    return `keel: ${entry} serves no deployable ${want}; set KEEL_DEPLOYABLE to one of ${names.join(", ")}`;
  return `keel: ${entry} needs a deployable; add a client or static one to topology.ts, or set KEEL_DEPLOYABLE to one`;
}
