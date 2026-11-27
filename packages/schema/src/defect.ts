import type { DefectCode } from "./DefectCode.ts";
import type { DefectDetail } from "./DefectDetail.ts";
import { DefectError } from "./internal/DefectError.ts";
import { records } from "./internal/records.ts";

/**
 * Throw a defect (k.defects): a failure no caller is meant to handle. `message` is the code's own words, never a
 * value; values go in `detail.data`, the failure that led here in `detail.cause`. The message is `<code> <message>`
 * when a code is given; `code` and `data` are own non-enumerable properties. Returns `never`, so it stands where a
 * value is expected (`x ?? defect('no row')`).
 */
export function defect(message: string, detail?: DefectDetail): never;
export function defect(message: string, code: DefectCode, detail?: DefectDetail): never;
export function defect(message: string, second?: DefectCode | DefectDetail, third?: DefectDetail): never {
  const code = typeof second === "string" ? second : undefined;
  const detail = typeof second === "object" ? second : third;
  const text = code === undefined ? message : `${code} ${message}`;
  const e =
    detail !== undefined && Object.hasOwn(detail, "cause")
      ? new DefectError(text, { cause: detail.cause })
      : new DefectError(text);
  if (code !== undefined) Object.defineProperty(e, "code", { value: code });
  if (detail?.data !== undefined) Object.defineProperty(e, "data", { value: detail.data });
  records.defect.add(e);
  throw e;
}
