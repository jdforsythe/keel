/** True for a non-null, non-array object. */
export function isRecord(x: unknown): x is Readonly<Record<string, unknown>> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
