import { isDefect } from "@keel/schema";
import { attempted } from "./attempted.ts";
import { unexpectedOf } from "./unexpectedOf.ts";

/**
 * A thrown value's text (k.serverlog Thrown values), whole: an `Error`'s `name: message`, a defect's with its `data`
 * as JSON after it, any other value's JSON or `String()` (`unexpectedOf`). It goes only into the HMAC of its
 * fingerprint and the full-text record. Never throws.
 */
export function thrownText(thrown: unknown): string {
  const text = unexpectedOf(thrown).data.cause;
  const data = attempted((): string => {
    if (!isDefect(thrown)) return "";
    const value: unknown = Object.getOwnPropertyDescriptor(thrown, "data")?.value;
    const json: unknown = value === undefined ? undefined : JSON.stringify(value);
    return typeof json === "string" ? ` ${json}` : "";
  });
  return data.ok ? text + data.value : text;
}
