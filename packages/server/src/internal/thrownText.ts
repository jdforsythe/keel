import { unexpectedOf } from "./unexpectedOf.ts";

/**
 * A thrown value's text (k.serverlog Thrown values), whole: an `Error`'s `name: message`, a defect's with its `data`
 * as JSON after it, any other value's JSON or `String()` (`unexpectedOf`). It goes only into the HMAC of its
 * fingerprint and the full-text record. Never throws.
 */
export function thrownText(thrown: unknown): string {
  return unexpectedOf(thrown).data.cause;
}
