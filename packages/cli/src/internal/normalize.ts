import { clip } from "@keel/compiler/internal";
import type { OutRecord } from "../types/OutRecord.ts";
import { registry } from "./registry.ts";

/**
 * Replace every record that has no formatter, or does not fit its formatter's schema, with an E1054 diagnostic.
 * After this every record renders in every mode.
 */
export function normalize(records: readonly OutRecord[]): OutRecord[] {
  return records.map((r) => {
    const entry = registry.get(r.kind);
    if (entry === undefined) return { kind: "diag", code: "E1054", message: `record kind ${r.kind} has no formatter` };
    if (entry.render("json", r) === undefined)
      return { kind: "diag", code: "E1054", message: `record of kind ${r.kind} does not fit its formatter schema` };
    if (r.kind !== "diag" || typeof r.message !== "string") return r;
    const message = clip(r.message, 89);
    return message === r.message ? r : { ...r, message };
  });
}
