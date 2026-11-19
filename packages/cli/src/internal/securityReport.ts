import type { Topology } from "@keel/compiler";
import type { Infer } from "@keel/schema";
import type { SecurityReport } from "../evidence/SecurityReport.ts";
import { cspText } from "./cspText.ts";
import { isRecord } from "./isRecord.ts";
import { keelModule } from "./keelModule.ts";
import { titleHeader } from "./titleHeader.ts";

type Report = Infer<typeof SecurityReport>;

/**
 * Binary only: `security.json` (k.evidence, k.security) from `@keel/server/csp`: per `node` deployable the headers it
 * sends on https and its document policy with the nonce written `<nonce>`; per `client` or `static` one the `csp.txt`
 * text `keel build` writes for it. Deployables are in name order; none are listed when the entry does not load.
 */
export async function securityReport(
  cwd: string,
  topology: Topology | undefined,
  env: Readonly<Record<string, string | undefined>>,
): Promise<Report> {
  const csp = await keelModule(cwd, "@keel/server/csp");
  const policyOf = csp?.cspPolicy;
  const headersOf = csp?.securityHeaders;
  if (topology === undefined || typeof policyOf !== "function" || typeof headersOf !== "function")
    return { v: 1, deployables: [] };
  const policy: unknown = policyOf({ nonce: "<nonce>" });
  const sent: unknown = headersOf({ https: true });
  const headers = Object.fromEntries(
    Object.entries(isRecord(sent) ? sent : {})
      .filter((e): e is [string, string] => typeof e[1] === "string")
      .map(([k, v]) => [titleHeader(k), v]),
  );
  const text = await cspText(cwd, topology, env);
  const deployables: Report["deployables"] = [];
  for (const name of Object.keys(topology).sort()) {
    const adapter = topology[name]?.adapter;
    if (adapter === "node" && typeof policy === "string") deployables.push({ adapter, name, headers, policy });
    if ((adapter === "client" || adapter === "static") && text !== undefined)
      deployables.push({ adapter, name, csp: text });
  }
  return { v: 1, deployables };
}
