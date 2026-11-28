import type { Origins, Topology } from "@keel/compiler";
import { peerOrigins } from "@keel/compiler/hosting/peerOrigins";
import { keelModule } from "./keelModule.ts";

/**
 * Binary only: the policy of a `client` or `static` document (k.security Other deployables) for a deployable's
 * declared `origins` (k.origins), `script-src 'self'` with `connect-src` adding each `keel-peer` origin of `env` and
 * then the declared ones: `cspPolicy({ peers, origins })` of `@keel/server/csp`. Undefined when that entry does not
 * load.
 */
export async function cspText(
  cwd: string,
  topology: Topology,
  env: Readonly<Record<string, string | undefined>>,
): Promise<((origins?: Origins) => string) | undefined> {
  const policy = (await keelModule(cwd, "@keel/server/csp"))?.cspPolicy;
  if (typeof policy !== "function") return undefined;
  const peers = peerOrigins(topology, env).origins.map(([, origin]) => origin);
  return (origins) => String(policy({ peers, origins }));
}
