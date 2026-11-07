/**
 * A relative literal path names a route (E1501, k.compiler URL policy): without its query and fragment and any
 * leading `./`, read from the root, it matches one of `patterns` segment by segment (`:name` matches any
 * non-empty segment; k.router has no wildcards). An empty path (`""`, `?q`) is the current page, not a route.
 */
export function matchesRoute(literal: string, patterns: readonly string[]): boolean {
  const pathPart = literal.trim().split(/[?#]/)[0] ?? "";
  if (pathPart === "") return false;
  const segments = `/${pathPart.replace(/^(?:\.\/)+/, "")}`.split("/").slice(1);
  return patterns.some((p) => {
    const want = p.split("/").slice(1);
    return (
      want.length === segments.length &&
      want.every((w, i) => {
        const got = segments[i] ?? "";
        return w.startsWith(":") ? got !== "" : w === got;
      })
    );
  });
}
