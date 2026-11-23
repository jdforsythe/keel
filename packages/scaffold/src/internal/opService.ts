import { declaredOrigins } from "@keel/compiler/hosting/declaredOrigins";
import type { Result } from "@keel/schema";
import { apiSchemaTs } from "../templates/apiSchemaTs.ts";
import { apiServerTs } from "../templates/apiServerTs.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { baseUrl } from "./baseUrl.ts";
import { commit } from "./commit.ts";
import { connectOrigin } from "./connectOrigin.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { jsonText } from "./jsonText.ts";
import { lineCol } from "./lineCol.ts";
import { pascal } from "./pascal.ts";
import { serviceBase } from "./serviceBase.ts";
import { targetsGenerated } from "./targetsGenerated.ts";
import { topologyAst } from "./topologyAst.ts";
import { topologyOf } from "./topologyOf.ts";

/**
 * `scaffold service <module>` (k.scaffold Service), in one of two forms. `base`: an empty endpoint declaration
 * `<Module>Api` and its client `api` at that URL, both the author's to edit. `schema` and `service`: the two sources
 * `@keel/services/openapi` generated (the cli converts the document; scaffold may not import services), placed as they
 * are, generated marker included, so later operations may not edit them (E1005). Either way the files are
 * `modules/<module>/<Module>Api.schema.ts` and `api.server.ts`, and `@keel/services` joins the project's `dependencies`
 * at the version of `@keel/server`. Where a `client` deployable lists the module, `api.server.ts` ships to the browser
 * (k.boundary), so the origin of the URL is declared under that deployable's `origins.connect` with `reason`
 * (k.origins); with no `reason` it is E1358, and what k.origins refuses is E1353 naming E1590. A `reason` with nothing
 * to declare, or an input in neither form, is E1052.
 */
export function opService(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.service.parse(input);
  if (!r.ok) return badInput("service", r.error);
  const { id, base, schema, service, reason } = r.value;
  if (targetsGenerated(id)) return fail("E1005", id, `${id} is a generated location`);
  if (!isLowerCamel(id)) return fail("E1352", `modules/${id}`, `module id ${id} must be lowerCamel`);
  const dir = `modules/${id}`;
  const name = `${pascal(id)}Api`;
  const sources =
    base !== undefined && schema === undefined && service === undefined
      ? { schema: apiSchemaTs(name), service: apiServerTs(name, base), url: base }
      : base === undefined && schema !== undefined && service !== undefined
        ? { schema, service, url: serviceBase("api.server.ts", service) }
        : null;
  if (sources === null)
    return fail("E1052", dir, "service takes base alone, or schema and service together (--base or --openapi)");
  if (base !== undefined && baseUrl(base) === null)
    return fail("E1052", dir, "base must be an absolute http or https URL with no query, fragment or credentials");
  if (!files.has(`${dir}/module.ts`)) return fail("E1052", dir, `${id} is not a module of this project`);
  const writes: Writes = new Map([
    [`${dir}/${name}.schema.ts`, sources.schema],
    [`${dir}/api.server.ts`, sources.service],
  ]);
  for (const p of writes.keys()) if (files.has(p)) return fail("E1351", p, `service ${id} already exists`);
  const origin = sources.url === undefined ? undefined : baseUrl(sources.url)?.origin;
  const topology = files.get("topology.ts");
  const open = Object.entries(topologyOf(files) ?? {})
    .filter(([, d]) => d.adapter === "client" && d.modules.includes(id))
    .filter(([, d]) => origin !== undefined && d.origins?.connect?.[origin] === undefined)
    .map(([deployable]) => deployable);
  const first = open[0];
  if (topology === undefined || origin === undefined || first === undefined) {
    if (reason !== undefined)
      return fail("E1052", dir, `reason has nothing to declare: no client deployable holding ${id} lacks the origin`);
  } else if (reason === undefined) {
    const at = topologyAst(topology)?.deployables.find((d) => d.name === first)?.prop.start;
    return fail(
      "E1358",
      "topology.ts",
      `${id} is on client deployable ${first}, which does not declare ${origin}`,
      undefined,
      at === undefined ? undefined : lineCol(topology, at),
    );
  } else {
    let next: string | null = topology;
    for (const deployable of open) next = next === null ? null : connectOrigin(next, deployable, origin, reason);
    if (next === null) return fail("E1052", "topology.ts", `topology.ts has no origins literal of ${first} to edit`);
    const known = new Set(declaredOrigins(topology).problems.map(([code, , message]) => `${code} ${message}`));
    const problem = declaredOrigins(next).problems.find(([code, , message]) => !known.has(`${code} ${message}`));
    if (problem !== undefined) {
      const [code, , message, at] = problem;
      const cause = { code, path: "topology.ts", line: lineCol(next, at ?? 0).line, message };
      return fail(
        "E1353",
        "topology.ts",
        `operation aborted, would introduce ${code}: ${message}; nothing written`,
        cause,
      );
    }
    writes.set("topology.ts", next);
  }
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
