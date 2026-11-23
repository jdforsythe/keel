import { openapi } from "@keel/services/openapi";
import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";
import { relPath } from "./relPath.ts";

/**
 * The generated `schema` and `service` texts of `keel scaffold service <name> --openapi <file>` (k.services OpenAPI).
 * The file comes from the Io file list (`files`, project-relative paths; `openapi` resolved against `cwd`). An absent
 * or non-JSON file, a document outside the supported subset or a bad name is E1052 naming `--openapi`.
 */
export function openapiInput(
  name: string | undefined,
  openapiFile: string,
  cwd: string,
  files: ReadonlyMap<string, string>,
):
  | { readonly ok: true; readonly value: { schema: string; service: string } }
  | { readonly ok: false; readonly diag: Diag } {
  const fail = (message: string) => ({ ok: false as const, diag: makeDiag("E1052", message, { see: "k.services" }) });
  const source = files.get(relPath(cwd, openapiFile));
  if (source === undefined) return fail(`--openapi file not found: ${JSON.stringify(openapiFile.slice(0, 60))}`);
  let doc: unknown;
  try {
    doc = JSON.parse(source);
  } catch {
    return fail(`--openapi file is not valid JSON: ${JSON.stringify(openapiFile.slice(0, 60))}`);
  }
  if (name === undefined) return fail("scaffold service needs a name");
  try {
    const r = openapi(doc, { name });
    if (!r.ok) {
      const first = r.error.data.issues[0];
      const at = first === undefined ? "" : ` at ${first.path.join(".") || "$"}`;
      return fail(`--openapi document is outside the supported OpenAPI subset${at}`);
    }
    return { ok: true, value: r.value };
  } catch {
    return fail(`service name ${JSON.stringify(name.slice(0, 24))} is not a module id`);
  }
}
