import { isRecord } from "./isRecord.ts";

/** The `{ [path]: message }` data of a `keel.fields` error; non-string entries are ignored. */
export function fieldMessages(data: unknown): Record<string, string> {
  if (!isRecord(data)) return {};
  const out: Record<string, string> = {};
  for (const [path, message] of Object.entries(data)) if (typeof message === "string") out[path] = message;
  return out;
}
