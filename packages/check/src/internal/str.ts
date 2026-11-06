/** A string field of a finding's data, or `""` when absent or not a string. */
export function str(data: Readonly<Record<string, string | number>> | undefined, key: string): string {
  const v = data?.[key];
  return typeof v === "string" ? v : "";
}
