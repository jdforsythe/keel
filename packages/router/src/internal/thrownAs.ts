import type { KeelError } from "@keel/schema";

/** What a thrown value reads as when a read of it throws: `Object.prototype.toString` of it, else its `typeof`. */
const opaque = (thrown: unknown): string => {
  try {
    return Object.prototype.toString.call(thrown);
  } catch {
    return `[unreadable ${thrown === null ? "null" : typeof thrown}]`;
  }
};

/**
 * The `keel.unexpected` KeelError the router's owner gives a thrown value (k.errors Boundary): an `Error` as
 * `<name>: <message>`, a string as is, anything else its JSON or `String()`, the message clipped to 89 characters.
 * `publicError` keeps the text out of a page unless `mode` is `dev`. Never throws, whatever was thrown.
 */
export function thrownAs(thrown: unknown): KeelError<"keel.unexpected", { readonly cause: string }> {
  let cause: string;
  try {
    if (thrown instanceof Error) cause = `${thrown.name}: ${thrown.message}`;
    else if (typeof thrown === "string") cause = thrown;
    else {
      const json: unknown = JSON.stringify(thrown);
      cause = typeof json === "string" ? json : String(thrown);
    }
  } catch {
    cause = opaque(thrown);
  }
  return { code: "keel.unexpected", message: cause.length <= 89 ? cause : `${cause.slice(0, 88)}…`, data: { cause } };
}
