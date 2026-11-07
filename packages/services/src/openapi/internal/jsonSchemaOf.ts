import type { Gen } from "./Gen.ts";
import type { Path } from "./Path.ts";
import { isRecord } from "./isRecord.ts";
import { resolve } from "./resolve.ts";

/** The `application/json` schema of a request body or response object (after `$ref`), with its path; else undefined. */
export function jsonSchemaOf(
  g: Gen,
  holder: unknown,
  at: Path,
): { readonly schema: unknown; readonly at: Path; readonly refs: ReadonlySet<string> } | undefined {
  const r = resolve(g, holder, at, new Set());
  if (r === undefined || !isRecord(r.node) || !isRecord(r.node.content)) return undefined;
  const json = r.node.content["application/json"];
  return isRecord(json) && json.schema !== undefined
    ? { schema: json.schema, at: [...at, "content", "application/json", "schema"], refs: r.refs }
    : undefined;
}
