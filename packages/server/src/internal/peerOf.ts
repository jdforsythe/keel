import type { PeerPath } from "./PeerPath.ts";

/**
 * The deployable among `paths` serving `pathname` (segment by segment, `:name` matching any non-empty one), if any.
 * A pathname not starting with exactly one `/` (`//host`, `/\host`) is no peer's.
 */
export function peerOf(paths: readonly PeerPath[], pathname: string): string | undefined {
  const parts = pathname.split("/").filter((x) => x !== "");
  return /^\/(?![/\\])/.test(pathname)
    ? paths.find(
        (p) => p.segments.length === parts.length && p.segments.every((s, i) => s.startsWith(":") || s === parts[i]),
      )?.deployable
    : undefined;
}
