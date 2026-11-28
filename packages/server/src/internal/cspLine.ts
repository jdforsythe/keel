/**
 * A `csp` log record (docs/OUTPUT.md, k.security Reports): one accepted report `{ kind, directive, blocked, route }`,
 * compact `csp img-src https://cdn.example app.item`, or a window's count `{ kind, dropped }`, compact `csp dropped 3`.
 */
export function cspLine(
  format: "compact" | "json",
  r: { readonly directive: string; readonly blocked: string; readonly route: string } | { readonly dropped: number },
): string {
  if ("dropped" in r)
    return format === "json" ? JSON.stringify({ kind: "csp", dropped: r.dropped }) : `csp dropped ${r.dropped}`;
  return format === "json"
    ? JSON.stringify({ kind: "csp", directive: r.directive, blocked: r.blocked, route: r.route })
    : `csp ${r.directive} ${r.blocked} ${r.route}`;
}
