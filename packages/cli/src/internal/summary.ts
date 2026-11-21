import type { OutRecord } from "../types/OutRecord.ts";
import { isError } from "./isError.ts";

/** The trailer record for `name` over `records`: ok when no error diagnostic is among them and `counts.errors`, when given, is 0. */
export function summary(
  name: string,
  records: readonly OutRecord[],
  counts: Readonly<Record<string, number>>,
): OutRecord {
  return { kind: "summary", ok: !records.some(isError) && (counts.errors ?? 0) === 0, name, counts };
}
