import type { Doc } from "./Doc.ts";
import type { Gen } from "./Gen.ts";
import type { Path } from "./Path.ts";
import { isRecord } from "./isRecord.ts";
import { keyText } from "./keyText.ts";
import { make } from "./make.ts";
import { resolve } from "./resolve.ts";
import { schemaSource } from "./schemaSource.ts";

type Param = { readonly name: string; readonly where: string; readonly src: Doc; readonly required: boolean };

/** The resolved parameters of a path item and an operation; the operation's override by `name` and `in`. */
function collect(g: Gen, lists: readonly { readonly list: unknown; readonly at: Path }[]): Map<string, Param> {
  const out = new Map<string, Param>();
  for (const { list, at } of lists) {
    if (!Array.isArray(list)) continue;
    list.forEach((raw, i) => {
      const r = resolve(g, raw, [...at, i], new Set());
      if (r === undefined || !isRecord(r.node)) return;
      const p = r.node;
      if (typeof p.name !== "string" || typeof p.in !== "string") {
        g.issues.push({ path: [...at, i, typeof p.name === "string" ? "in" : "name"], rule: "required" });
        return;
      }
      const src = schemaSource(g, p.schema, [...at, i, "schema"], r.refs);
      out.set(`${p.in} ${p.name}`, { name: p.name, where: p.in, src, required: p.required === true });
    });
  }
  return out;
}

/**
 * `params` and `query` object schemas for one operation (undefined when it has none). Every `:name` of `path`
 * gets a field (an undeclared one is `s.string()`); path parameters that are not in `path` are dropped; query
 * fields are optional unless `required`. Header and cookie parameters have no k.services form and are skipped.
 */
export function paramsSource(
  g: Gen,
  names: readonly string[],
  lists: readonly { readonly list: unknown; readonly at: Path }[],
): { readonly params: Doc | undefined; readonly query: Doc | undefined } {
  const all = collect(g, lists);
  const fields = names.map((n): [string, Doc] => [keyText(n), all.get(`path ${n}`)?.src ?? "s.string()"]);
  const query = [...all.values()]
    .filter((p) => p.where === "query")
    .map((p): [string, Doc] => [keyText(p.name), p.required ? p.src : make.chain(p.src, ".optional()")]);
  return {
    params: fields.length === 0 ? undefined : make.call("s.object", make.obj(fields)),
    query: query.length === 0 ? undefined : make.call("s.object", make.obj(query)),
  };
}
