import { type JsonValue, type Result, attempt, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import { fail } from "./fail.ts";
import { isFields } from "./isFields.ts";
import { textOf } from "./textOf.ts";

const PARAM = /:([A-Za-z_$][\w$]*)/g;

/**
 * Replace each `:name` in `path` with the URL-encoded text of the encoded param. A value `encodeURIComponent`
 * rejects (a lone surrogate) is `api.input` at `params.<name>`.
 */
export function fillPath(path: string, params: JsonValue | undefined): Result<string, ApiError<never>> {
  const fields = isFields(params) ? params : {};
  let bad: string | undefined;
  const filled = path.replace(PARAM, (_match, name: string) => {
    const r = attempt(() => encodeURIComponent(textOf(Object.hasOwn(fields, name) ? fields[name] : undefined)));
    if (r.ok) return r.value;
    bad ??= name;
    return "";
  });
  return bad === undefined ? ok(filled) : err(fail.input([{ path: ["params", bad], rule: "type" }]));
}
