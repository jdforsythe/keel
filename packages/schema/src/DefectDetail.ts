import type { DefectCode } from "./DefectCode.ts";

/**
 * What a defect carries besides its message (k.defects): `code`, the diagnostic code of the section that names the
 * throw; `data`, the values that explain it; and `cause`, the failure that led to it (a `Result`'s error or a thrown
 * value).
 */
export type DefectDetail = {
  readonly code?: DefectCode;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
};
