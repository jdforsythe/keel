import type { Topology } from "../types/Topology.ts";
import { originOf } from "./originOf.ts";
import { peerKey } from "./peerKey.ts";

/**
 * `[deployable, message]` for each origin a deployable of `topology` declares under `frame` that is one of the app's
 * own origins `env` names at build (k.origins Frame): a `node` deployable's `KEEL_PEER_<NAME>`, or `KEEL_ORIGIN`. A
 * frame of the app's own origin runs with the document's origin, so its sandbox holds nothing back. The message
 * names the key, never its value.
 */
export function ownFrameProblems(
  topology: Topology,
  env: Readonly<Record<string, string | undefined>>,
): [string, string][] {
  const own = new Map<string, string>();
  for (const name of Object.keys(topology).sort()) {
    const key = peerKey(name);
    const at = topology[name]?.adapter === "node" ? originOf(env[key] ?? "") : undefined;
    if (at !== undefined && !own.has(at)) own.set(at, key);
  }
  const self = originOf(env.KEEL_ORIGIN ?? "");
  if (self !== undefined && !own.has(self)) own.set(self, "KEEL_ORIGIN");
  return Object.entries(topology).flatMap(([name, d]) =>
    Object.keys(d.origins?.frame ?? {}).flatMap((o): [string, string][] => {
      const key = own.get(o);
      return key === undefined ? [] : [[name, `${name}: origins.frame: ${o} is the app's own origin (${key})`]];
    }),
  );
}
