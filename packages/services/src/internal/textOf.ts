import type { JsonValue } from "@keel/schema";

/** The text of an encoded path param: strings as is, null as empty, other JSON as its literal. */
export function textOf(v: JsonValue | undefined): string {
  if (v === undefined || v === null) return "";
  return typeof v === "string" ? v : JSON.stringify(v);
}
