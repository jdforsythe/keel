/** A numeric field of a finding's data, or `fallback` when absent or not a number. */
export function num(data: Readonly<Record<string, string | number>> | undefined, key: string, fallback = -1): number {
  const v = data?.[key];
  return typeof v === "number" ? v : fallback;
}
