import type { DefectCode } from "./DefectCode.ts";
import { DefectError } from "./internal/DefectError.ts";
import { defects } from "./internal/defects.ts";

/**
 * Throw a defect (k.errors Defects): a failure no caller is meant to handle, a bug in the calling code or a broken
 * invariant. The message is `<code> <message>` when a code is given, and `code` is then a non-enumerable own property.
 * Returns `never`, so it stands where a value is expected (`x ?? defect(...)`, `c ? v : defect(...)`).
 */
export function defect(message: string, code?: DefectCode): never {
  const e = new DefectError(code === undefined ? message : `${code} ${message}`);
  if (code !== undefined) Object.defineProperty(e, "code", { value: code, enumerable: false });
  defects.add(e);
  throw e;
}
