import type { Result } from "@keel/schema";
import MagicString from "magic-string";
import { componentTsx } from "../templates/componentTsx.ts";
import { loaderTs } from "../templates/loaderTs.ts";
import { routeEntry } from "../templates/routeEntry.ts";
import { routeTest } from "../templates/routeTest.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { appendProperty } from "./appendProperty.ts";
import { badInput } from "./badInput.ts";
import { basenames } from "./basenames.ts";
import { callArgObject } from "./callArgObject.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { insertImports } from "./insertImports.ts";
import { isPascal } from "./isPascal.ts";
import { lineIndent } from "./lineIndent.ts";
import { parseSource } from "./parseSource.ts";
import { pascal } from "./pascal.ts";
import { routeId } from "./routeId.ts";
import { routeTable } from "./routeTable.ts";
import { targetsGenerated } from "./targetsGenerated.ts";

const SEGMENT = /^(?::[a-z][a-zA-Z0-9]*|[a-z0-9][a-z0-9-]*)$/;

/** `/a/:id` -> pattern `/a/:` (param names do not distinguish routes, E1502). */
const pattern = (path: string): string => path.replace(/:[^/]+/g, ":");

/** True when `src` imports the binding `s` from @keel/schema. */
function importsS(src: string): boolean {
  return /^import\s*\{[^}]*(?<![\w$])s(?![\w$])[^}]*\}\s*from\s*['"]@keel\/schema['"]/m.test(src);
}

/**
 * `scaffold route <module>.<name> --path <path> [--file <page.tsx>] [--api]`: a manifest entry in the module's
 * `routes.ts`, a `<name>.server.ts` loader, a page component, and a route test. `api` (k.api) writes an API entry
 * (`api: true`, no `component`) and a JSON request test, and no page.
 */
export function opRoute(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.route.parse(input);
  if (!r.ok) return badInput("route", r.error);
  const { id, path, file, api } = r.value;
  if (targetsGenerated(id) || (file !== undefined && targetsGenerated(file)))
    return fail("E1005", file ?? id, `${file ?? id} is a generated location`);
  const rid = routeId(id);
  if (rid === null) return fail("E1352", id, `route id ${id} must be dotted lowerCamel segments prefixed by a module`);
  const { mod, leaf } = rid;
  const dir = `modules/${mod}`;
  const routesPath = `${dir}/routes.ts`;
  if (!files.has(`${dir}/module.ts`)) return fail("E1352", id, `${mod} is not a module of this project`);
  if (
    path !== "/" &&
    (!path.startsWith("/") ||
      !path
        .slice(1)
        .split("/")
        .every((s) => SEGMENT.test(s)))
  )
    return fail("E1352", routesPath, `route path ${path} must be /-separated lowercase segments or :params`);
  const pagePath = file ?? `${dir}/${pascal(leaf)}Page.tsx`;
  const page = (pagePath.split("/").pop() ?? "").replace(/\.tsx$/, "");
  if (
    api === true ? file !== undefined : !pagePath.startsWith(`${dir}/`) || !pagePath.endsWith(".tsx") || !isPascal(page)
  )
    return fail("E1352", pagePath, `page file must be ${dir}/<Name>.tsx with a PascalCase name`);
  const table = routeTable(files);
  if (table.has(id)) return fail("E1351", table.get(id)?.file ?? routesPath, `route ${id} already exists`);
  for (const [other, def] of table)
    if (def.path !== null && pattern(def.path) === pattern(path))
      return fail("E1351", def.file, `path ${path} is already routed by ${other}`);
  const loaderName = `load${pascal(leaf)}`;
  const loaderPath = `${dir}/${loaderName}.server.ts`;
  const inTestDir = files.has("vitest.config.ts");
  const testPath = inTestDir ? `test/${mod}.${leaf}.route.test.ts` : `${dir}/${leaf}.route.test.ts`;
  for (const p of [loaderPath, testPath, ...(api === true ? [] : basenames(files, `${page}.tsx`))])
    if (files.has(p)) return fail("E1351", p, `${p} already exists`);
  const src = files.get(routesPath);
  const program = src === undefined ? null : parseSource(routesPath, src);
  const obj = program === null ? null : callArgObject(program, "manifest");
  if (src === undefined || program === null || obj === null)
    return fail("E1052", routesPath, `${routesPath} has no manifest({...}) to add the route to`);
  const params = [...path.matchAll(/:([a-zA-Z0-9]+)/g)].map((m) => m[1] ?? "");
  const ms = new MagicString(src);
  const pageSpec = `./${pagePath.slice(dir.length + 1)}`;
  insertImports(ms, program, [
    ...(params.length > 0 && !importsS(src) ? [`import { s } from "@keel/schema";`] : []),
    ...(api === true ? [] : [`import ${page} from "${pageSpec}";`]),
    `import { ${loaderName} } from "./${loaderName}.server.ts";`,
  ]);
  const last = obj.properties[obj.properties.length - 1];
  const multi = last !== undefined && src.slice(obj.start, obj.properties[0]?.start ?? obj.start).includes("\n");
  const ind = multi && last !== undefined ? lineIndent(src, last.start) : `${lineIndent(src, obj.start)}  `;
  const entry = routeEntry(id, path, params, loaderName, api === true ? null : page)
    .split("\n")
    .join(`\n${ind}`);
  appendProperty(ms, src, obj, entry, true);
  const writes: Writes = new Map([
    [routesPath, ms.toString()],
    [loaderPath, loaderTs(loaderName)],
    [testPath, routeTest(id, params, inTestDir ? `../${dir}/routes.ts` : "./routes.ts", api === true ? path : null)],
  ]);
  if (api !== true) writes.set(pagePath, componentTsx(page));
  return commit(files, writes);
}
