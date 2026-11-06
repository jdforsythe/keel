/** Sort paths by code unit (locale-independent, deterministic). */
export function sortedKeys(paths: Iterable<string>): string[] {
  return [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
