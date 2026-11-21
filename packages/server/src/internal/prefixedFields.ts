import type { KeelError } from "@keel/schema";

type Fields = KeelError<"keel.fields", Readonly<Record<string, string>>>;

/** A `keel.fields` error of one request part of an API entry (k.api Requests): each path prefixed `query` or `body`. */
export function prefixedFields(part: "query" | "body", e: Fields): Fields {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.data)) data[k === "" ? part : `${part}.${k}`] = v;
  return { ...e, data };
}
