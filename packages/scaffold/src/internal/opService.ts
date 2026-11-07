import type { Result } from "@keel/schema";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { targetsGenerated } from "./targetsGenerated.ts";

/**
 * `scaffold service <module> --openapi <file>`: place the endpoint declaration and the service file that
 * `@keel/services/openapi` generated (the cli converts the document; scaffold may not import services) at
 * `modules/<module>/api.schema.ts` and `api.ts` (k.services). Both carry the generated marker, so later operations
 * may not edit them (E1005).
 */
export function opService(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.service.parse(input);
  if (!r.ok) return badInput("service", r.error);
  const { id, schema, service } = r.value;
  if (targetsGenerated(id)) return fail("E1005", id, `${id} is a generated location`);
  if (!isLowerCamel(id)) return fail("E1352", `modules/${id}`, `module id ${id} must be lowerCamel`);
  const dir = `modules/${id}`;
  if (!files.has(`${dir}/module.ts`)) return fail("E1052", dir, `${id} is not a module of this project`);
  const writes: Writes = new Map([
    [`${dir}/api.schema.ts`, schema],
    [`${dir}/api.ts`, service],
  ]);
  for (const p of writes.keys()) if (files.has(p)) return fail("E1351", p, `service ${id} already exists`);
  return commit(files, writes);
}
