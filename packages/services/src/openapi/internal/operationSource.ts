import type { Doc } from "./Doc.ts";
import type { Gen } from "./Gen.ts";
import type { Path } from "./Path.ts";
import { isRecord } from "./isRecord.ts";
import { jsonSchemaOf } from "./jsonSchemaOf.ts";
import { make } from "./make.ts";
import { paramsSource } from "./paramsSource.ts";
import { schemaSource } from "./schemaSource.ts";

const NAME = /\{([^}]*)\}/g;

/** The schema found by `jsonSchemaOf`, or undefined. */
function jsonSource(g: Gen, holder: unknown, at: Path): Doc | undefined {
  const j = jsonSchemaOf(g, holder, at);
  return j === undefined ? undefined : schemaSource(g, j.schema, j.at, j.refs);
}

/** `output` (lowest 2xx JSON response, else `s.json()`) and `errors` (other numeric statuses with a JSON body). */
function responses(g: Gen, op: Readonly<Record<string, unknown>>, at: Path): { output: Doc; errors: [string, Doc][] } {
  const all = isRecord(op.responses) ? op.responses : {};
  const statuses = Object.keys(all)
    .filter((k) => /^[1-5]\d\d$/.test(k))
    .sort();
  const ok = statuses.find((k) => k.startsWith("2"));
  const output = (ok === undefined ? undefined : jsonSource(g, all[ok], [...at, "responses", ok])) ?? "s.json()";
  const errors = statuses.flatMap((k): [string, Doc][] => {
    if (k.startsWith("2")) return [];
    const src = jsonSource(g, all[k], [...at, "responses", k]);
    return src === undefined ? [] : [[k, src]];
  });
  return { output, errors };
}

/**
 * One endpoint declaration: `method`, `path` with `:name` segments, then `params`, `query`, `body`, `output`,
 * `errors` when present. A `{name}` that is not an identifier is an issue.
 */
export function operationSource(
  g: Gen,
  method: string,
  path: string,
  item: Readonly<Record<string, unknown>>,
  op: Readonly<Record<string, unknown>>,
  at: Path,
): Doc {
  const names: string[] = [];
  const keelPath = path.replace(NAME, (_m, name: string) => {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) g.issues.push({ path: at.slice(0, -1), rule: "type" });
    names.push(name);
    return `:${name}`;
  });
  const { params, query } = paramsSource(g, names, [
    { list: item.parameters, at: [...at.slice(0, -1), "parameters"] },
    { list: op.parameters, at: [...at, "parameters"] },
  ]);
  const body = op.requestBody === undefined ? undefined : jsonSource(g, op.requestBody, [...at, "requestBody"]);
  const { output, errors } = responses(g, op, at);
  const entries: [string, Doc | undefined][] = [
    ["method", JSON.stringify(method.toUpperCase())],
    ["path", JSON.stringify(keelPath)],
    ["params", params],
    ["query", query],
    ["body", body],
    ["output", output],
    ["errors", errors.length === 0 ? undefined : make.obj(errors)],
  ];
  return make.obj(entries.flatMap(([k, v]): [string, Doc][] => (v === undefined ? [] : [[k, v]])));
}
