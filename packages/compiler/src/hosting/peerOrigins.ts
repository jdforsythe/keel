import type { Topology } from "../types/Topology.ts";
import { originOf } from "./originOf.ts";
import { peerKey } from "./peerKey.ts";

/**
 * The `keel-peer` origins a `client` build writes (k.hosting Peers): for each `node` deployable of `topology` whose
 * `KEEL_PEER_<NAME>` is set in `env`, its name -> the value's origin (`originOf`), in name order. `bad` lists the keys
 * whose value is not an http(s) origin (E1565); never their values.
 */
export function peerOrigins(
  topology: Topology,
  env: Readonly<Record<string, string | undefined>>,
): { origins: [string, string][]; bad: string[] } {
  const origins: [string, string][] = [];
  const bad: string[] = [];
  for (const name of Object.keys(topology).sort()) {
    const key = peerKey(name);
    const value = env[key];
    if (topology[name]?.adapter !== "node" || value === undefined) continue;
    const origin = originOf(value);
    if (origin === undefined) bad.push(key);
    else origins.push([name, origin]);
  }
  return { origins, bad };
}
