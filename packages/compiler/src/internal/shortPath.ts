/**
 * `p` with its leading segments dropped (`a/b/c.ts` to `.../b/c.ts` to `.../c.ts`) until it is at most `room` UTF-16
 * code units or only its last segment is left; never cut at its end (k.check Diagnostics).
 */
export function shortPath(p: string, room: number): string {
  let rest = p.startsWith(".../") ? p.slice(4) : p;
  let out = p;
  while (out.length > room && rest.includes("/")) {
    rest = rest.slice(rest.indexOf("/") + 1);
    out = `.../${rest}`;
  }
  return out;
}
