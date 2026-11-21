import type { Def } from "@keel/router/internal";
import { fieldsError } from "@keel/router/internal";
import { type KeelError, type Result, err, ok } from "@keel/schema";
import type { Rec } from "./Rec.ts";
import { prefixedFields } from "./prefixedFields.ts";

/**
 * An API entry's `query` decoded from `search` by its schema, which may require keys (k.api Requests): a failure is
 * `keel.fields` with each path prefixed `query`. `ok(undefined)` for a page or an API entry without `query`.
 */
export function decodedQuery(
  def: Def,
  search: URLSearchParams,
): Result<Rec | undefined, KeelError<"keel.fields", Readonly<Record<string, string>>>> {
  if (def.kind !== "api" || def.query === undefined) return ok(undefined);
  const r = def.query.decodeStrings(search);
  if (!r.ok) return err(prefixedFields("query", fieldsError(def.query.node, r.error)));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(Object(r.value))) out[k] = v;
  return ok(out);
}
