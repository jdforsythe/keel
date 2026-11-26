import type { DefectCode } from "../DefectCode.ts";

/** What `defect` throws (k.errors Defects): an `Error` named `Defect`, with its code when one was given. */
export type Defect = Error & { readonly name: "Defect"; readonly code?: DefectCode };
