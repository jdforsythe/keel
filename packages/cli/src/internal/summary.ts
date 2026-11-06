import type { OutRecord } from "../types/OutRecord.ts";
import { isError } from "./isError.ts";

/** The trailer record for `name` over `records`: ok when no error diagnostic is among them. */
export function summary(
  name: string,
  records: readonly OutRecord[],
  counts: Readonly<Record<string, number>>,
): OutRecord {
  return { kind: "summary", ok: !records.some(isError), name, counts };
}
