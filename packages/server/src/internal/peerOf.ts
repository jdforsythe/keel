import type { PeerPath } from "./PeerPath.ts";

/**
 * The path among `paths` serving `pathname` (segment by segment, `:name` matching any non-empty one), if any; a
 * matching `local` path before any other, so a `local` route is never forwarded through a wider path that also matches.
 * A pathname not starting with exactly one `/` (`//host`, `/\host`) is no peer's.
 */
export function peerOf(paths: readonly PeerPath[], pathname: string): PeerPath | undefined {
  const parts = pathname.split("/").filter((x) => x !== "");
  if (!/^\/(?![/\\])/.test(pathname)) return undefined;
  const hits = paths.filter(
    (p) => p.segments.length === parts.length && p.segments.every((s, i) => s.startsWith(":") || s === parts[i]),
  );
  return hits.find((p) => p.local === true) ?? hits[0];
}
