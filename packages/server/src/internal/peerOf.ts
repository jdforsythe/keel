import type { PeerPath } from "./PeerPath.ts";

/**
 * The first path among `paths` serving `pathname` (segment by segment, `:name` matching any non-empty one), if any. It
 * picks where a request is forwarded and judges no route: the peer matches it with its own matcher (k.topology Calls
 * and peers). A pathname not starting with exactly one `/` (`//host`, `/\host`) is no peer's.
 */
export function peerOf(paths: readonly PeerPath[], pathname: string): PeerPath | undefined {
  const parts = pathname.split("/").filter((x) => x !== "");
  if (!/^\/(?![/\\])/.test(pathname)) return undefined;
  return paths.find(
    (p) => p.segments.length === parts.length && p.segments.every((s, i) => s.startsWith(":") || s === parts[i]),
  );
}
