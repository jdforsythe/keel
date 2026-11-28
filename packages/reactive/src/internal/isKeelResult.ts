/** The brand k.schema `ok`/`err` put on every `Result` they make (`Symbol.for`, so no dependency on that package). */
const BRAND = Symbol.for("keel.result");

/** True only for a `Result` made by k.schema `ok`/`err`; a plain `{ ok, value }` or `{ ok, error }` object is not one. */
export function isKeelResult(v: unknown): boolean {
  return typeof v === "object" && v !== null && BRAND in v;
}
