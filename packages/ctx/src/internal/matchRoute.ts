/** True when `url` matches `pattern`: exact, or prefix when the pattern ends in `*`. */
export function matchRoute(pattern: string, url: string): boolean {
  return pattern.endsWith("*") ? url.startsWith(pattern.slice(0, -1)) : url === pattern;
}
