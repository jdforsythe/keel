import type { Program } from "oxc-parser";
import type { EndpointParams } from "../internal/EndpointParams.ts";
import { endpointLiterals } from "../internal/endpointLiterals.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { keyName } from "../internal/keyName.ts";
import { num } from "../internal/num.ts";
import { paramsFields } from "../internal/paramsFields.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { removeProperty } from "../internal/removeProperty.ts";
import { str } from "../internal/str.ts";
import type { Edit } from "../types/Edit.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

function pathOf(obj: Parameters<typeof propertyOf>[0]): { text: string; at: number } | null {
  const p = propertyOf(obj, "path");
  const v = p?.value;
  if (p === null || v === undefined) return null;
  if (v.type === "Literal" && typeof v.value === "string") return { text: v.value, at: p.start };
  if (v.type === "TemplateLiteral" && v.expressions.length === 0) {
    const cooked = v.quasis[0]?.value.cooked;
    return typeof cooked === "string" ? { text: cooked, at: p.start } : null;
  }
  return null;
}

/** The `s` binding of `import { s } from '@keel/schema'`, or `null` when the file has none. */
function schemaLocal(ast: Program): string | null {
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/schema") continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportSpecifier" && sp.imported.type === "Identifier" && sp.imported.name === "s")
        return sp.local.name;
    }
  }
  return null;
}

const PARAM = /:([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * E1652 (k.services): in an `endpoints({...})` literal, a `:param` in a literal `path` with no field in a
 * literal `params: s.object({...})`, or a `params` field not named in `path`. Endpoints whose path or params
 * are not literal are skipped. Missing fields are one finding at `path` (fix adds `name: s.string()` fields,
 * or a `params` property when the endpoint has none and `s` is imported); an extra field is one finding at the
 * field (fix removes it).
 */
export const pathParamsMatch: RuleDef = {
  code: "E1652",
  message: (f) =>
    str(f.data, "kind") === "missing"
      ? `path param(s) ${str(f.data, "names")} have no field in params`
      : `params field ${str(f.data, "names")} is not a :param in path`,
  explain: "Path params and the params schema describe one set of names; each :param needs a field and the reverse.",
  see: "k.services",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    for (const { obj } of endpointLiterals(ast)) {
      if (obj.properties.some((p) => p.type !== "Property")) continue;
      const path = pathOf(obj);
      const params = paramsFields(obj);
      if (path === null || params === "dynamic") continue;
      const inPath = Array.from(new Set(Array.from(path.text.matchAll(PARAM), (m) => m[1] ?? "")));
      const fieldNames = params === "absent" ? [] : params.props.map((q) => keyName(q) ?? "");
      const missing = inPath.filter((n) => !fieldNames.includes(n));
      if (missing.length > 0)
        out.push(findingAt(file, path.at, { kind: "missing", names: missing.join(","), at: path.at }));
      if (params === "absent") continue;
      for (const q of params.props) {
        const name = keyName(q) ?? "";
        if (!inPath.includes(name)) out.push(findingAt(file, q.start, { kind: "extra", names: name, at: q.start }));
      }
    }
    return out;
  },
  fix: (f, { ast }) => {
    const at = num(f.data, "at");
    const names = str(f.data, "names").split(",");
    for (const { obj } of endpointLiterals(ast)) {
      const params = paramsFields(obj);
      if (params === "dynamic") continue;
      if (str(f.data, "kind") === "extra") {
        if (params === "absent") continue;
        const q = params.props.find((x) => x.start === at);
        if (q === undefined) continue;
        const edit = removeProperty(params.fields, q);
        return edit === null ? null : [edit];
      }
      if (pathOf(obj)?.at !== at) continue;
      if (params === "absent") {
        const s = schemaLocal(ast);
        const last = obj.properties[obj.properties.length - 1];
        if (s === null || last === undefined) return null;
        const fields = names.map((n) => `${n}: ${s}.string()`).join(", ");
        const edit: Edit = { start: last.end, end: last.end, text: `, params: ${s}.object({ ${fields} })` };
        return [edit];
      }
      const fields = names.map((n) => `${n}: ${params.s}.string()`);
      const last = params.props[params.props.length - 1];
      const edit: Edit =
        last === undefined
          ? { start: params.fields.start + 1, end: params.fields.start + 1, text: ` ${fields.join(", ")} ` }
          : { start: last.end, end: last.end, text: `, ${fields.join(", ")}` };
      return [edit];
    }
    return null;
  },
};
