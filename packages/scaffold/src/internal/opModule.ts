import type { Result } from "@keel/schema";
import MagicString from "magic-string";
import { ciWorkflow } from "../templates/ciWorkflow.ts";
import { moduleTs } from "../templates/moduleTs.ts";
import { routesTs } from "../templates/routesTs.ts";
import { turboJson } from "../templates/turboJson.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { appendItems } from "./appendItems.ts";
import { badInput } from "./badInput.ts";
import { callArgObject } from "./callArgObject.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { moduleIds } from "./moduleIds.ts";
import { parseSource } from "./parseSource.ts";
import { propertyValue } from "./propertyValue.ts";
import { targetsGenerated } from "./targetsGenerated.ts";

/** Add `id` to the `modules` list of the first deployable in `topology.ts`; null when there is no such list. */
function addToTopology(src: string, id: string): string | null {
  const program = parseSource("topology.ts", src);
  const obj = program === null ? null : callArgObject(program, "topology");
  const first = obj?.properties[0];
  if (first?.type !== "Property" || first.value.type !== "ObjectExpression") return null;
  const list = propertyValue(first.value, "modules");
  if (list?.type !== "ArrayExpression") return null;
  const ms = new MagicString(src);
  appendItems(ms, src, list, [id]);
  return ms.toString();
}

/** `scaffold module <id>`: manifest and routes, the module added to `topology.ts`, turbo and CI regenerated. */
export function opModule(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
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
  const generated: string[] = [];
  if (files.has("turbo.json")) generated.push("turbo.json");
  if (files.has(".github/workflows/ci.yml")) generated.push(".github/workflows/ci.yml");
  if (generated.includes("turbo.json")) writes.set("turbo.json", turboJson([...moduleIds(files), id]));
  if (generated.includes(".github/workflows/ci.yml")) writes.set(".github/workflows/ci.yml", ciWorkflow());
  return commit(files, writes, generated);
}
