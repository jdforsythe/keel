import type { Result } from "@keel/schema";
import { moduleTs } from "../templates/moduleTs.ts";
import { routesTs } from "../templates/routesTs.ts";
import type { DeployShells } from "../types/DeployShells.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { insertItem } from "./insertItem.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { regenerated } from "./regenerated.ts";
import { targetsGenerated } from "./targetsGenerated.ts";
import { topologyAst } from "./topologyAst.ts";
import { withWrites } from "./withWrites.ts";

/** Add `id` to the `modules` list of the first deployable in `topology.ts`, sorted; null when there is no such list. */
function addToTopology(src: string, id: string): string | null {
  const first = topologyAst(src)?.deployables[0];
  return first === undefined ? null : insertItem(src, first.list, id);
}

/** `scaffold module <id>`: manifest and routes, the module added to `topology.ts`, turbo, CI and deploy files regenerated. */
export function opModule(
  input: unknown,
  files: ReadonlyMap<string, string>,
  shells: DeployShells = {},
): Result<Edit, ScaffoldError> {
  const r = inputs.module.parse(input);
  if (!r.ok) return badInput("module", r.error);
  const { id } = r.value;
  if (targetsGenerated(id)) return fail("E1005", id, `${id} is a generated location`);
  if (!isLowerCamel(id)) return fail("E1352", `modules/${id}`, `module id ${id} must be lowerCamel`);
  const manifest = `modules/${id}/module.ts`;
  for (const p of files.keys())
    if (p.startsWith(`modules/${id}/`)) return fail("E1351", manifest, `module ${id} already exists; use a codemod`);
  const topo = files.get("topology.ts");
  if (topo === undefined) return fail("E1052", "topology.ts", "no topology.ts; run scaffold project first");
  const nextTopo = addToTopology(topo, id);
  if (nextTopo === null) return fail("E1052", "topology.ts", "topology.ts has no deployable with a modules list");
  const writes: Writes = new Map([
    [manifest, moduleTs(id)],
    [`modules/${id}/routes.ts`, routesTs()],
    ["topology.ts", nextTopo],
  ]);
  const gen = regenerated(withWrites(files, writes), shells);
  return commit(files, new Map([...writes, ...gen]), [...gen.keys()]);
}
