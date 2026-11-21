import { type Result, type SchemaError, err, ok } from "@keel/schema";
import type { OpenApiFiles } from "./OpenApiFiles.ts";
import type { OpenApiOptions } from "./OpenApiOptions.ts";
import type { Doc } from "./internal/Doc.ts";
import type { Gen } from "./internal/Gen.ts";
import { HEADER } from "./internal/HEADER.ts";
import { IDENT } from "./internal/IDENT.ts";
import { METHODS } from "./internal/METHODS.ts";
import { isRecord } from "./internal/isRecord.ts";
import { operationSource } from "./internal/operationSource.ts";
import { pascal } from "./internal/pascal.ts";
import { printDoc } from "./internal/printDoc.ts";
import { serverUrl } from "./internal/serverUrl.ts";

/** Names a component const may not take: the file's imports and JS reserved words. */
const RESERVED = (
  "s endpoints await break case catch class const continue debugger default delete do else enum export extends " +
  "false finally for function if implements import in instanceof interface let new null package private protected " +
  "public return static super switch this throw true try typeof var void while with yield"
).split(" ");

/** Every endpoint of the doc keyed by operationId, in document order; issues for bad or duplicate operationIds. */
function endpointsOf(g: Gen, paths: Readonly<Record<string, unknown>>): [string, Doc][] {
  const out: [string, Doc][] = [];
  const ids = new Set<string>();
  for (const [path, item] of Object.entries(paths)) {
    if (!isRecord(item) || !path.startsWith("/")) {
      g.issues.push({ path: ["paths", path], rule: "type" });
      continue;
    }
    for (const method of Object.keys(item).filter((k) => METHODS.includes(k))) {
      const op = item[method];
      const at = ["paths", path, method];
      const id = isRecord(op) ? op.operationId : undefined;
      if (!isRecord(op) || typeof id !== "string" || !IDENT.test(id) || ids.has(id)) {
        g.issues.push({ path: [...at, "operationId"], rule: typeof id === "string" ? "type" : "required" });
        continue;
      }
      ids.add(id);
      out.push([id, operationSource(g, method, path, item, op, at)]);
    }
  }
  return out;
}

/**
 * Generate the k.services declaration and client for an OpenAPI 3 JSON document (k.services OpenAPI, rfc:0034):
 * `schema` is `<Name>Api.schema.ts` (`<Name>Api = endpoints({...})`, one endpoint per operation keyed by `operationId`;
 * the filename equals its one export, rfc:0039) and `service` is `api.server.ts` (`api = service({ base: servers[0].url,
 * schema })`, importing `./<Name>Api.schema.ts`). A document outside the supported
 * subset is `err` `schema.invalid` with one issue per problem, its path into the doc. Throws only on an invalid `name`.
 */
export function openapi(doc: unknown, opts: OpenApiOptions): Result<OpenApiFiles, SchemaError> {
  const name = `${pascal(opts.name)}Api`;
  if (!/^[a-z]/i.test(opts.name) || !IDENT.test(name))
    throw new RangeError(`openapi name is not a module id: ${opts.name}`);
  if (!isRecord(doc)) return err(invalid([{ path: [], rule: "type" }]));
  const g: Gen = { doc, issues: [], named: new Map(), reserved: new Set([...RESERVED, name]) };
  if (typeof doc.openapi !== "string" || !doc.openapi.startsWith("3.")) {
    g.issues.push({ path: ["openapi"], rule: typeof doc.openapi === "string" ? "literal" : "required" });
  }
  const base = serverUrl(g);
  const body = isRecord(doc.paths) ? endpointsOf(g, doc.paths) : [];
  if (!isRecord(doc.paths)) g.issues.push({ path: ["paths"], rule: "required" });
  if (g.issues.length > 0 || base === undefined) return err(invalid(g.issues));
  const consts = [...g.named].map(([k, d]) => `const ${k} = ${printDoc(d, 0, k.length + 9, 1)};\n`).join("");
  const decl = printDoc(
    { t: "call", callee: "endpoints", args: [{ t: "obj", entries: body }], suffix: "" },
    0,
    name.length + 16,
    1,
  );
  const schema = `${HEADER}import { s } from "@keel/schema";\nimport { endpoints } from "@keel/services";\n\n${consts}${consts === "" ? "" : "\n"}export const ${name} = ${decl};\n`;
  const service = `${HEADER}import { service } from "@keel/services";\nimport { ${name} } from "./${name}.schema.ts";\n\nexport const api = service({ base: ${JSON.stringify(base)}, schema: ${name} });\n`;
  return ok({ schema, service });
}

function invalid(issues: SchemaError["data"]["issues"]): SchemaError {
  return { code: "schema.invalid", message: "OpenAPI document outside the supported subset", data: { issues } };
}
