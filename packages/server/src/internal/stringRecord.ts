/** The string-valued own entries of `v` (a `keel.fields` error's `data`), else `{}`. */
export function stringRecord(v: unknown): Readonly<Record<string, string>> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  return Object.fromEntries(
    Object.entries(v).flatMap(([k, x]): [string, string][] => (typeof x === "string" ? [[k, x]] : [])),
  );
}
