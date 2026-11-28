import { declaredOrigins } from "@keel/compiler/hosting/declaredOrigins";
import type { DeployTopology } from "../types/DeployTopology.ts";
import { topologyAst } from "./topologyAst.ts";

/**
 * The deployables `topology.ts` declares, read statically, each with its declared origins (`declaredOrigins`,
 * k.origins); an option the file leaves out is undefined. Null when the file is missing or does not parse.
 */
export function topologyOf(files: ReadonlyMap<string, string>): DeployTopology | null {
  const src = files.get("topology.ts");
  const ast = src === undefined ? null : topologyAst(src);
  if (ast === null) return null;
  const { origins } = declaredOrigins(src);
  const out: Record<string, DeployTopology[string]> = {};
  for (const { name, modules, adapter, servedBy, storage, shells } of ast.deployables)
    out[name] = { modules, adapter, servedBy, storage, shells, origins: origins[name] };
  return out;
}
