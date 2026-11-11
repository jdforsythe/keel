import type { PeerPath } from "./PeerPath.ts";

/** The deployable among `paths` serving `pathname` (segment by segment, `:name` matching any non-empty one), if any. */
export function peerOf(paths: readonly PeerPath[], pathname: string): string | undefined {
  const parts = pathname.split("/").filter((x) => x !== "");
  return paths.find(
    (p) => p.segments.length === parts.length && p.segments.every((s, i) => s.startsWith(":") || s === parts[i]),
  )?.deployable;
}
