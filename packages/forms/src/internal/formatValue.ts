/** Text shown in an input for a stored value; absent and null show as empty. */
export function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return Object.is(v, -0) ? "-0" : String(v);
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}
