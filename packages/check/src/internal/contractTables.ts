import type { Topology } from "@keel/compiler";
import type { ModuleContract } from "./ModuleContract.ts";

/**
 * Each deployable's route table as `keel check` reads it (k.routes Where rules fire): the contracts of the modules
 * the project's topology gives the deployable, in topology order; with no topology, the project's modules form one.
 * One list of tables per project directory.
 */
export function contractTables(
  contracts: readonly ModuleContract[],
  topologyOf: (dir: string) => Topology | undefined,
): ModuleContract[][] {
  const out: ModuleContract[][] = [];
  const dirs = [...new Set(contracts.map((c) => c.dir))];
  for (const dir of dirs) {
    const here = contracts.filter((c) => c.dir === dir);
    const topology = topologyOf(dir);
    if (topology === undefined) {
      out.push(here);
      continue;
    }
    for (const d of Object.values(topology))
      out.push(d.modules.flatMap((m) => here.filter((c) => c.module === m).slice(0, 1)));
  }
  return out;
}
