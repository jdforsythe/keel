import type { Result } from "@keel/schema";
import MagicString from "magic-string";
import { actionTs } from "../templates/actionTs.ts";
import { bindingEntry } from "../templates/bindingEntry.ts";
import { componentTsx } from "../templates/componentTsx.ts";
import { contractEntry } from "../templates/contractEntry.ts";
import { loaderTs } from "../templates/loaderTs.ts";
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
import { topologyOf } from "./topologyOf.ts";

const SEGMENT = /^(?::[a-z][a-zA-Z0-9]*|[a-z0-9][a-z0-9-]*)$/;

/** `/a/:id` -> pattern `/a/:` (param names do not distinguish routes, E1502). */
const pattern = (path: string): string => path.replace(/:[^/]+/g, ":");

/** True when `src` imports the binding `s` from @keel/schema. */
function importsS(src: string): boolean {
  return /^import\s*\{[^}]*(?<![\w$])s(?![\w$])[^}]*\}\s*from\s*['"]@keel\/schema['"]/m.test(src);
}

/** A page file as given: a bare name (`Pick`, `Pick.tsx`) sits in the module's folder; anything with a `/` is a path. */
function pageFile(dir: string, file: string | undefined): string | undefined {
  if (file === undefined || file.includes("/")) return file;
  return `${dir}/${file.endsWith(".tsx") ? file : `${file}.tsx`}`;
}

const VERB: Readonly<Record<string, string>> = { POST: "post", PUT: "put", PATCH: "patch", DELETE: "delete" };

/** `src` with entry text appended to the object literal of its `fn(…, {…})` call (argument 1), plus any import lines; null when there is no such call. */
function addEntry(path: string, src: string, fn: string, entry: string, imports: readonly string[]): string | null {
  const program = parseSource(path, src);
  const obj = program === null ? null : callArgObject(program, fn, 1);
  if (program === null || obj === null) return null;
  const ms = new MagicString(src);
  insertImports(ms, program, imports);
  const last = obj.properties[obj.properties.length - 1];
  const multi = last !== undefined && src.slice(obj.start, obj.properties[0]?.start ?? obj.start).includes("\n");
  const ind = multi && last !== undefined ? lineIndent(src, last.start) : `${lineIndent(src, obj.start)}  `;
  appendProperty(ms, src, obj, entry.split("\n").join(`\n${ind}`), true);
  return ms.toString();
}

/**
 * `scaffold route <module>.<name> --path <path> [--file <page.tsx>] [--api [--method <verb>]]`: an entry in the
 * module's `<module>.contract.ts` and its binding in `routes.ts`, a `*.server.ts` handler naming the entry (a loader;
 * an action for an API write), a page component, and a route test. `api` (k.api) writes an API entry (`method`,
 * default `GET`; `output`) and a JSON request test, and no page; `method` without `api` is E1052.
 */
export function opRoute(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.route.parse(input);
  if (!r.ok) return badInput("route", r.error);
  const { id, path, file, api, method } = r.value;
  if (method !== undefined && api !== true)
    return fail("E1052", id, "method is for an API route: pass api with method, or drop method");
  if (targetsGenerated(id) || (file !== undefined && targetsGenerated(file)))
    return fail("E1005", file ?? id, `${file ?? id} is a generated location`);
  const rid = routeId(id);
  if (rid === null) return fail("E1352", id, `route id ${id} must be dotted lowerCamel segments prefixed by a module`);
  const { mod, leaf } = rid;
  if (api === true && id.split(".").length !== 2)
    return fail("E1352", id, `API route id ${id} must be <module>.<name>, name one lowerCamel segment`);
  const dir = `modules/${mod}`;
  const routesPath = `${dir}/routes.ts`;
  const contractPath = `${dir}/${mod}.contract.ts`;
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
  const pagePath = pageFile(dir, file) ?? `${dir}/${pascal(leaf)}Page.tsx`;
  const page = (pagePath.split("/").pop() ?? "").replace(/\.tsx$/, "");
  if (
    api === true ? file !== undefined : !pagePath.startsWith(`${dir}/`) || !pagePath.endsWith(".tsx") || !isPascal(page)
  )
    return fail("E1352", pagePath, `page file must be ${dir}/<Name>.tsx with a PascalCase name`);
  const verb = method ?? "GET";
  const table = routeTable(files);
  if (table.has(id)) return fail("E1351", table.get(id)?.file ?? contractPath, `route ${id} already exists`);
  for (const [other, def] of table)
    if (def.path !== null && pattern(def.path) === pattern(path) && (def.method ?? "GET") === verb)
      return fail("E1351", def.file, `path ${path} is already routed by ${other}`);
  const handlerName = `${VERB[verb] ?? "load"}${pascal(leaf)}`;
  const handlerPath = `${dir}/${handlerName}.server.ts`;
  const inTestDir = files.has("vitest.config.ts");
  const testPath = inTestDir ? `test/${mod}.${leaf}.route.test.ts` : `${dir}/${leaf}.route.test.ts`;
  for (const p of [handlerPath, testPath, ...(api === true ? [] : basenames(files, `${page}.tsx`))])
    if (files.has(p)) return fail("E1351", p, `${p} already exists`);
  const params = [...path.matchAll(/:([a-zA-Z0-9]+)/g)].map((m) => m[1] ?? "");
  const contractSrc = files.get(contractPath);
  const routesSrc = files.get(routesPath);
  const nextContract =
    contractSrc === undefined
      ? null
      : addEntry(
          contractPath,
          contractSrc,
          "contract",
          contractEntry(id, path, params, api === true ? verb : null),
          params.length > 0 || api === true ? (importsS(contractSrc) ? [] : [`import { s } from "@keel/schema";`]) : [],
        );
  if (contractSrc === undefined || nextContract === null)
    return fail("E1052", contractPath, `${contractPath} has no contract("${mod}", {...}) to add the route to`);
  const write = api === true && verb !== "GET";
  const pageSpec = `./${pagePath.slice(dir.length + 1)}`;
  const nextRoutes =
    routesSrc === undefined
      ? null
      : addEntry(routesPath, routesSrc, "manifest", bindingEntry(id, handlerName, api === true ? null : page, write), [
          ...(api === true ? [] : [`import ${page} from "${pageSpec}";`]),
          `import { ${handlerName} } from "./${handlerName}.server.ts";`,
        ]);
  if (routesSrc === undefined || nextRoutes === null)
    return fail("E1052", routesPath, `${routesPath} has no manifest(${mod}, {...}) to add the route to`);
  const writes: Writes = new Map([
    [contractPath, nextContract],
    [routesPath, nextRoutes],
    [handlerPath, write ? actionTs(handlerName, mod, id) : loaderTs(handlerName, mod, id, api === true)],
    [
      testPath,
      routeTest(
        id,
        params,
        inTestDir ? `../${dir}/routes.ts` : "./routes.ts",
        api === true ? { path, method: verb } : null,
        Object.values(topologyOf(files) ?? {}).some((d) => d.adapter === "node" && d.modules.includes(mod)),
      ),
    ],
  ]);
  if (api !== true) writes.set(pagePath, componentTsx(page));
  return commit(files, writes);
}
