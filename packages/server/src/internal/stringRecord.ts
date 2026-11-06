/** The string-valued own entries of `v` (a `keel.fields` error's `data`), else `{}`. */
export function stringRecord(v: unknown): Readonly<Record<string, string>> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string"));
}
