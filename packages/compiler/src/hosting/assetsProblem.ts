/**
 * The E1579 message (k.user Rules) for a `handle.path` at or under `/assets`, where a built client's files are served
 * (k.deploy); `undefined` for any other path. `<p>` is the path's JSON text cut to 40 units, so the message is at
 * most 89 units.
 */
export function assetsProblem(p: string): string | undefined {
  return p === "/assets" || p.startsWith("/assets/")
    ? `handle.path ${JSON.stringify(p).slice(0, 40)} is at or under /assets (built files)`
    : undefined;
}
