import type { Topology } from "../types/Topology.ts";
import { peerOrigins } from "./peerOrigins.ts";

/**
 * The origins a shell's `net` may send to beside its `KEEL_ORIGIN` (k.shell Origins): in order and once each, the
 * `keel-peer` origins the web build of `topology` writes under `env` (`peerOrigins`), then the declared
 * `origins.connect` origins of `deployable`, without `origin` (the build's `KEEL_ORIGIN` origin, none when the topology has no `node` deployable).
 */
export function shellConnect(
  topology: Topology,
  deployable: string,
  env: Readonly<Record<string, string | undefined>>,
  origin?: string,
): readonly string[] {
  const peers = peerOrigins(topology, env).origins.map(([, o]) => o);
  const declared = Object.keys(topology[deployable]?.origins?.connect ?? {});
  return [...new Set([...peers, ...declared])].filter((o) => o !== origin);
}
