import type { Result } from "@keel/schema";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { jsonText } from "./jsonText.ts";
import { pascal } from "./pascal.ts";
import { targetsGenerated } from "./targetsGenerated.ts";

/**
 * `scaffold service <module> --openapi <file>`: place the endpoint declaration and the service file that
 * `@keel/services/openapi` generated (the cli converts the document; scaffold may not import services) at
 * `modules/<module>/<Module>Api.schema.ts` (filename equals its export `<Module>Api`, rfc:0039) and
 * `api.server.ts`, and adds `@keel/services` to the project's `dependencies` at the version of `@keel/server` (k.openapi: a literal `base` there is clean in a module a `node` deployable lists, and E1571 in one only `client` deployables list, where the file ships). Both carry the generated marker, so later operations may not edit them (E1005).
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
    [`${dir}/${pascal(id)}Api.schema.ts`, schema],
    [`${dir}/api.server.ts`, service],
  ]);
  for (const p of writes.keys()) if (files.has(p)) return fail("E1351", p, `service ${id} already exists`);
  const manifest = withServices(files.get("package.json"));
  if (manifest !== undefined) writes.set("package.json", manifest);
  return commit(files, writes);
}

/** `package.json` text with `@keel/services` in `dependencies` (at `@keel/server`'s spec), or undefined when it is unreadable or already names it. */
function withServices(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  let pkg: unknown;
  try {
    pkg = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof pkg !== "object" || pkg === null) return undefined;
  const deps: unknown = Reflect.get(pkg, "dependencies");
  if (typeof deps !== "object" || deps === null || Reflect.has(deps, "@keel/services")) return undefined;
  const server: unknown = Reflect.get(deps, "@keel/server");
  const added = { ...deps, "@keel/services": typeof server === "string" ? server : "^0.0.0" };
  const sorted = Object.fromEntries(Object.entries(added).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${jsonText({ ...pkg, dependencies: sorted })}\n`;
}
