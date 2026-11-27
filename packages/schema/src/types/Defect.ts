import type { DefectCode } from "../DefectCode.ts";

/** What `defect` throws (k.defects): an `Error` named `Defect`, with its code and data when given. */
export type Defect = Error & {
  readonly name: "Defect";
  readonly code?: DefectCode;
  readonly data?: Readonly<Record<string, unknown>>;
};
