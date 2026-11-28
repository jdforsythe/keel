import type { Infer } from "@keel/schema";
import type { UnreachableData } from "./UnreachableData.schema.ts";

/** What the error page says of an `inspector.unreachable`: one text per answer. */
export function unreachableText(d: Infer<typeof UnreachableData>): string {
  return d.why === "origin" ? "?url= is not the origin of an app on this machine" : `no inspect document at ${d.url}`;
}
