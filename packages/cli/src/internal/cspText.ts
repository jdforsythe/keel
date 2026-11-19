import type { Topology } from "@keel/compiler";
import { peerOrigins } from "@keel/compiler/hosting/peerOrigins";
import { keelModule } from "./keelModule.ts";

/**
 * Binary only: the policy of a `client` or `static` document (k.security Other deployables), `script-src 'self'` with
 * `connect-src` adding each `keel-peer` origin of `env`: `cspPolicy({ peers })` of `@keel/server/csp`. Undefined when
 * that entry does not load.
 */
export async function cspText(
  cwd: string,
  topology: Topology,
  env: Readonly<Record<string, string | undefined>>,
): Promise<string | undefined> {
  const csp = await keelModule(cwd, "@keel/server/csp");
  const policy = csp?.cspPolicy;
  if (typeof policy !== "function") return undefined;
  const text: unknown = policy({ peers: peerOrigins(topology, env).origins.map(([, origin]) => origin) });
  return typeof text === "string" ? text : undefined;
}
