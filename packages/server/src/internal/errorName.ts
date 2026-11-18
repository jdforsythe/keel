/**
 * The name a log may give a thrown value: an `Error`'s `name` when it is one a failed fetch or a runtime gives (`Error`,
 * `TypeError`, `RangeError`, `AbortError`, `TimeoutError`, `DOMException`), else `Error`, so a name app code chose never
 * reaches the log. Every read runs inside a try, and the message is never read, so the name holds no request value.
 * Never throws.
 */
export function errorName(thrown: unknown): string {
  try {
    const name: unknown = thrown instanceof Error ? thrown.name : undefined;
    return typeof name === "string" && /^((Type|Range|Abort|Timeout)?Error|DOMException)$/.test(name) ? name : "Error";
  } catch {
    return "Error";
  }
}
