import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { ModuleContract } from "./ModuleContract.ts";
import { resolveExpr } from "./compat/resolveExpr.ts";
import { diagAt } from "./diagAt.ts";
import { isRequiredField } from "./isRequiredField.ts";
import { literalPath } from "./literalPath.ts";
import { objectFields } from "./objectFields.ts";
import { propertyOf } from "./propertyOf.ts";

const PARAM = /^:([A-Za-z_][A-Za-z0-9_]*)$/;

/**
 * E1503 and E1504 (k.router) from each module contract's literal, schemas read through consts and relative imports
 * where they resolve statically: a `:name` in a page or API `path` with no `params` field (at `path`) or a `params`
 * field not in `path`; a page `search` field that is not `.optional()` (an API `query` may require keys).
 */
export function contractFields(contracts: readonly ModuleContract[], project: readonly SourceFile[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const { contract } of contracts) {
    const file = contract.file;
    for (const e of contract.list) {
      if (e.obj === null || e.kind === "layout") continue;
      const path = literalPath(e.obj);
      const params = propertyOf(e.obj, "params");
      const fields = params === null ? [] : objectFields(resolveExpr(params.value, file, project), project);
      if (path !== null && fields !== null) {
        const names = path.text.split("/").flatMap((s) => {
          const m = PARAM.exec(s);
          return m?.[1] === undefined ? [] : [m[1]];
        });
        for (const n of names)
          if (!fields.some((f) => f.name === n))
            out.push(diagAt(file, path.at.start, "E1503", `${e.id}: ":${n}" has no params field`, "k.router"));
        for (const f of fields)
          if (!names.includes(f.name)) {
            const at = f.file === file ? f.prop.start : (params?.start ?? path.at.start);
            out.push(diagAt(file, at, "E1503", `${e.id}: params field "${f.name}" is not in path`, "k.router"));
          }
      }
      const search = e.kind === "page" ? propertyOf(e.obj, "search") : null;
      if (search === null) continue;
      for (const f of objectFields(resolveExpr(search.value, file, project), project) ?? [])
        if (isRequiredField(f.value, project) === true) {
          const at = f.file === file ? f.prop.start : search.start;
          out.push(diagAt(file, at, "E1504", `${e.id}: search field "${f.name}" must be optional`, "k.router"));
        }
    }
  }
  return out;
}
