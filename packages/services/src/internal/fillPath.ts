import { type JsonValue, type Result, attempt, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import { fail } from "./fail.ts";
import { isFields } from "./isFields.ts";
import { textOf } from "./textOf.ts";

const PARAM = /:([A-Za-z_$][\w$]*)/g;
/** Values that are no segment of their own: an empty one joins its neighbours, `.` and `..` are dot segments. */
const NO_SEGMENT: ReadonlySet<string> = new Set(["", ".", ".."]);

/**
 * Replace each `:name` in `path` with the URL-encoded text of the encoded param, one segment each (`/` and `\` are
 * encoded too). A value of `''`, `.` or `..` is `api.input` `format` at `params.<name>`, and one `encodeURIComponent`
 * rejects (a lone surrogate) `type`.
 */
export function fillPath(path: string, params: JsonValue | undefined): Result<string, ApiError<never>> {
  const fields = isFields(params) ? params : {};
  let bad: ApiError<never> | undefined;
  const filled = path.replace(PARAM, (_match, name: string) => {
    const text = textOf(Object.hasOwn(fields, name) ? fields[name] : undefined);
    const r = attempt(
      () => encodeURIComponent(text),
      (x) => (x instanceof URIError ? fail.input([{ path: ["params", name], rule: "type" }]) : undefined),
    );
    if (r.ok && !NO_SEGMENT.has(text)) return r.value;
    bad ??= r.ok ? fail.input([{ path: ["params", name], rule: "format" }]) : r.error;
    return "";
  });
  return bad === undefined ? ok(filled) : err(bad);
}
