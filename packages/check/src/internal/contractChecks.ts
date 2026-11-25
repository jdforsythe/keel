import { parseTopology } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import { contractFields } from "./contractFields.ts";
import { contractImports } from "./contractImports.ts";
import { contractPlacement } from "./contractPlacement.ts";
import { contractTables } from "./contractTables.ts";
import { layoutLinks } from "./layoutLinks.ts";
import { moduleContracts } from "./moduleContracts.ts";
import { discoverModules } from "./modules/discoverModules.ts";
import { pathClashes } from "./pathClashes.ts";
import { prefixCollisions } from "./prefixCollisions.ts";

/**
 * The static contract pass (k.contract, k.routes, k.prefix) over the checked files: E1513 placement, E1514 imports,
 * E1503 and E1504 from each module contract's literal, E1502 per contract and per deployable's table, E1509 per
 * deployable's table, E1506 for a binding's `layout` of another module per deployable's table. A project's topology
 * is `topology` for the root when given, else the static parse of its `topology.ts` among `project`; with none, its
 * modules form one table.
 */
export function contractChecks(
  files: readonly Checked[],
  project: readonly SourceFile[],
  topology: Topology | undefined,
): Diagnostic[] {
  const contracts = moduleContracts(files);
  const topologyOf = (dir: string): Topology | undefined => {
    if (dir === "" && topology !== undefined) return topology;
    const source = project.find((f) => f.path === `${dir}topology.ts`)?.source;
    const parsed = source === undefined ? undefined : parseTopology(source).topology;
    return parsed === undefined || Object.keys(parsed).length === 0 ? undefined : parsed;
  };
  const tables = contractTables(contracts, topologyOf);
  const std = new Set(
    discoverModules(files, project)
      .filter((m) => m.library)
      .map((m) => m.prefix),
  );
  return [
    ...contractPlacement(files),
    ...contractImports(files),
    ...contractFields(
      contracts,
      files.map((c) => c.file),
    ),
    ...pathClashes(contracts, tables),
    ...prefixCollisions(files, tables),
    ...layoutLinks(files, tables, std),
  ];
}
