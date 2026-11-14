import type { DeployTopology } from "../types/DeployTopology.ts";
import { topologyAst } from "./topologyAst.ts";

/** The deployables `topology.ts` declares, read statically; null when it is missing or does not parse. */
export function topologyOf(files: ReadonlyMap<string, string>): DeployTopology | null {
  const src = files.get("topology.ts");
  const ast = src === undefined ? null : topologyAst(src);
  if (ast === null) return null;
  const out: Record<string, DeployTopology[string]> = {};
  for (const { name, modules, adapter, host, storage, shells } of ast.deployables)
    out[name] = {
      modules,
      adapter,
      ...(host === undefined ? {} : { host }),
      ...(storage === undefined ? {} : { storage }),
      ...(shells === undefined ? {} : { shells }),
    };
  return out;
}
