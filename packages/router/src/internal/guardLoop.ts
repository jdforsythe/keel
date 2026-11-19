import { MAX_GUARD_HOPS } from "./MAX_GUARD_HOPS.ts";

/**
 * Why a guard redirect to `to` after `visited` (the request URL, then each redirect location) is E1508:
 * `to` revisits one, or it would be redirect number nine. `null` when the redirect may go.
 */
export function guardLoop(visited: readonly string[], to: string): string | null {
  if (visited.includes(to)) return `guard redirect loop: ${[...visited, to].join(" -> ")}`;
  if (visited.length > MAX_GUARD_HOPS) return `more than ${MAX_GUARD_HOPS} guard redirects from ${visited[0] ?? to}`;
  return null;
}
