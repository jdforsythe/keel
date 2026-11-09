import type { JsonValue, KeelError } from "@keel/schema";
import { sha256 } from "./sha256.ts";

/**
 * A session's fingerprint (std.sessions): the first 12 hex characters of sha256(`code`, `data.at` when a string,
 * route id when it occurred), joined by newlines; with no error, `''`, `''` and the base route id.
 */
export function fingerprint(error: KeelError<string, JsonValue> | null, routeId: string): string {
  const data = error?.data;
  const at =
    typeof data === "object" && data !== null && !Array.isArray(data) && "at" in data && typeof data.at === "string"
      ? data.at
      : "";
  return sha256(`${error?.code ?? ""}\n${at}\n${routeId}`).slice(0, 12);
}
