import type { Infer } from "@keel/schema";
import type { UnreachableData } from "./UnreachableData.schema.ts";

/** What the error page says of an `inspector.unreachable`: the target, then why. */
export function unreachableText(d: Infer<typeof UnreachableData>): string {
  const why =
    d.why === "status"
      ? `answered ${d.status ?? 0}`
      : d.why === "decode"
        ? "did not return an inspect document"
        : d.why === "timeout"
          ? "timed out"
          : "is unreachable";
  return `${d.url} ${why}`;
}
