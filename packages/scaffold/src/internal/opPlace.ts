import { deployableNameProblem } from "@keel/compiler/hosting/deployableNameProblem";
import type { Result } from "@keel/schema";
import type { DeployShells } from "../types/DeployShells.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { addDeployable } from "./addDeployable.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { insertItem } from "./insertItem.ts";
import { regenerated } from "./regenerated.ts";
import { removeDeployable } from "./removeDeployable.ts";
import { removeItem } from "./removeItem.ts";
import { topologyAst } from "./topologyAst.ts";
import { withWrites } from "./withWrites.ts";

/**
 * `codemod place <module> --to <deployable> [--adapter]` (k.scaffold Codemods): move the module's entry in
 * `topology.ts` to deployable `to`, creating it (needs `adapter`) or removing the one it leaves empty, then regenerate
 * the CI workflow and deploy files. Nothing else changes. Insertion is sorted (modules and new deployables), so
 * placing a module back restores the bytes of a sorted `topology.ts`.
 */
export function opPlace(
  input: unknown,
  files: ReadonlyMap<string, string>,
  shells: DeployShells = {},
): Result<Edit, ScaffoldError> {
  const r = inputs.place.parse(input);
  if (!r.ok) return badInput("place", r.error);
  const { module, to, adapter } = r.value;
  const problem = deployableNameProblem(to);
  if (problem !== undefined) return fail("E1352", "topology.ts", problem);
  const src = files.get("topology.ts");
  if (src === undefined) return fail("E1052", "topology.ts", "no topology.ts; run scaffold project first");
  const ast = topologyAst(src);
  if (ast === null) return fail("E1052", "topology.ts", "topology.ts has no readable topology({...}) call");
  const from = ast.deployables.find((d) => d.modules.includes(module));
  if (from === undefined) return fail("E1052", "topology.ts", `module ${module} is in no deployable of topology.ts`);
  const target = ast.deployables.find((d) => d.name === to);
  if (target === undefined && adapter === undefined)
    return fail("E1052", "topology.ts", `new deployable ${to} needs --adapter node|client|static`);
  if (target !== undefined && adapter !== undefined && target.adapter !== adapter)
    return fail("E1052", "topology.ts", `deployable ${to} is ${target.adapter}, not ${adapter}`);
  if (from.name === to) return commit(files, new Map());
  const q = src.charAt(from.list.start + 1) === "'" ? "'" : '"';
  const added =
    target !== undefined
      ? insertItem(src, target.list, module)
      : addDeployable(
          src,
          ast.obj,
          to,
          `${to.includes("-") ? `${q}${to}${q}` : to}: { modules: [${q}${module}${q}], adapter: ${q}${adapter}${q} }`,
        );
  const mid = topologyAst(added);
  const left = mid?.deployables.find((d) => d.name === from.name);
  if (mid === null || left === undefined) return fail("E1052", "topology.ts", "topology.ts could not be edited");
  const next =
    left.modules.length === 1 ? removeDeployable(added, mid.obj, from.name) : removeItem(added, left.list, module);
  const own: Writes = new Map([["topology.ts", next]]);
  const gen = regenerated(withWrites(files, own), shells);
  gen.delete("turbo.json");
  return commit(files, new Map([...own, ...gen]), [...gen.keys()]);
}
