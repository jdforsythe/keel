/** A plain JSON object (not null, not an array). */
export function isRecord(x: unknown): x is Readonly<Record<string, unknown>> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
